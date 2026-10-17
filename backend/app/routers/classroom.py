import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.classroom import GoogleClassroomConnection
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User

router = APIRouter(prefix="/classroom", tags=["Google Classroom Integration"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

CLASSROOM_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
]

OAUTH_STATE_TTL_MINUTES = 10


# ---------------------------------------------------------------------------
# Token encryption (same AES-GCM scheme as github.py)
# ---------------------------------------------------------------------------

def _token_key() -> bytes:
    return hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()


def _encrypt_token(token: str) -> str:
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(_token_key()).encrypt(nonce, token.encode("utf-8"), None)
    return (nonce + ciphertext).hex()


def _decrypt_token(value: str) -> str:
    raw = bytes.fromhex(value)
    nonce, ciphertext = raw[:12], raw[12:]
    return AESGCM(_token_key()).decrypt(nonce, ciphertext, None).decode("utf-8")


# ---------------------------------------------------------------------------
# OAuth state helpers (JWT, same pattern as github.py)
# ---------------------------------------------------------------------------

def _make_state(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "purpose": "classroom_oauth",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=OAUTH_STATE_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _user_id_from_state(state: str) -> uuid.UUID:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("purpose") != "classroom_oauth":
            raise ValueError("Wrong purpose")
        return uuid.UUID(payload["sub"])
    except (JWTError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state") from exc


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_credentials(connection: GoogleClassroomConnection) -> Credentials:
    """Reconstruct Google credentials from the stored DB record."""
    access_token = _decrypt_token(connection.access_token)
    refresh_token = _decrypt_token(connection.refresh_token) if connection.refresh_token else None
    expiry = connection.token_expiry

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=CLASSROOM_SCOPES,
    )
    if expiry:
        creds.expiry = expiry
    return creds


async def _refresh_if_needed(connection: GoogleClassroomConnection, db: AsyncSession) -> Credentials:
    """Refresh token if expired and persist updated token back to DB."""
    creds = _build_credentials(connection)
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleAuthRequest())
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            connection.access_token = _encrypt_token(creds.token)
            connection.token_expiry = creds.expiry.replace(tzinfo=None) if creds.expiry else None
            connection.updated_at = now
            await db.commit()
        except Exception:
            raise HTTPException(status_code=401, detail="Google token refresh failed. Please reconnect.")
    return creds


async def _exchange_and_store(code: str, state: str, db: AsyncSession) -> str:
    """Exchange OAuth code for tokens, upsert into DB, return the user's email."""
    user_id = _user_id_from_state(state)
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google Classroom OAuth is not configured on the backend")

    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GOOGLE_CLASSROOM_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Google token exchange failed")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    if not access_token:
        raise HTTPException(status_code=400, detail=token_data.get("error_description", "Google authorization failed"))

    # Fetch user profile
    async with httpx.AsyncClient(timeout=10) as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if userinfo_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not read Google user profile")

    userinfo = userinfo_response.json()
    google_user_id = userinfo.get("sub")
    google_email = userinfo.get("email", "")

    if not google_user_id:
        raise HTTPException(status_code=502, detail="Google returned an incomplete user profile")

    # Calculate token expiry
    expires_in = token_data.get("expires_in")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    token_expiry = None
    if expires_in:
        token_expiry = (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).replace(tzinfo=None)

    # Upsert connection
    existing = await db.scalar(
        select(GoogleClassroomConnection).where(GoogleClassroomConnection.user_id == user_id)
    )
    if existing:
        existing.google_user_id = google_user_id
        existing.google_email = google_email
        existing.access_token = _encrypt_token(access_token)
        if refresh_token:
            existing.refresh_token = _encrypt_token(refresh_token)
        existing.token_expiry = token_expiry
        existing.updated_at = now
    else:
        db.add(
            GoogleClassroomConnection(
                user_id=user_id,
                google_user_id=google_user_id,
                google_email=google_email,
                access_token=_encrypt_token(access_token),
                refresh_token=_encrypt_token(refresh_token) if refresh_token else None,
                token_expiry=token_expiry,
                connected_at=now,
                updated_at=now,
            )
        )
    await db.commit()
    return google_email


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/authorize", status_code=status.HTTP_200_OK)
async def classroom_authorize(current_user: User = Depends(get_current_user)):
    """Return a Google OAuth URL for the classroom scopes."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLASSROOM_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="Google Classroom OAuth is not configured on the backend")

    state = _make_state(current_user.id)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_CLASSROOM_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(CLASSROOM_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return {"authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
async def classroom_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Google redirects here after the user authorizes. Exchanges code for tokens."""
    app_uri = settings.GOOGLE_CLASSROOM_APP_REDIRECT_URI
    if error:
        return RedirectResponse(f"{app_uri}?connected=false&error={error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")

    try:
        email = await _exchange_and_store(code, state, db)
        query = urlencode({"connected": "true", "email": email})
        return RedirectResponse(f"{app_uri}?{query}")
    except HTTPException as exc:
        return RedirectResponse(f"{app_uri}?connected=false&error={exc.detail}")
    except Exception as exc:
        return RedirectResponse(f"{app_uri}?connected=false&error=internal_error")


@router.get("/status", status_code=status.HTTP_200_OK)
async def classroom_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await db.scalar(
        select(GoogleClassroomConnection).where(GoogleClassroomConnection.user_id == current_user.id)
    )
    if not connection:
        return {"connected": False}
    return {"connected": True, "email": connection.google_email}


@router.get("/courses", response_model=List[Dict[str, Any]])
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active Google Classroom courses for the connected user."""
    connection = await db.scalar(
        select(GoogleClassroomConnection).where(GoogleClassroomConnection.user_id == current_user.id)
    )
    if not connection:
        raise HTTPException(status_code=409, detail="Connect Google Classroom before listing courses")

    creds = await _refresh_if_needed(connection, db)
    try:
        service = build("classroom", "v1", credentials=creds, cache_discovery=False)
        result = service.courses().list(courseStates=["ACTIVE"], pageSize=20).execute()
        courses = result.get("courses", [])
        return [
            {
                "id": c["id"],
                "name": c.get("name", "Unnamed Course"),
                "section": c.get("section"),
                "description_heading": c.get("descriptionHeading"),
                "room": c.get("room"),
                "enrollment_code": c.get("enrollmentCode"),
                "alternate_link": c.get("alternateLink"),
            }
            for c in courses
        ]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch courses: {exc}")


@router.get("/assignments", response_model=List[Dict[str, Any]])
async def list_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all coursework assignments across all active courses."""
    connection = await db.scalar(
        select(GoogleClassroomConnection).where(GoogleClassroomConnection.user_id == current_user.id)
    )
    if not connection:
        raise HTTPException(status_code=409, detail="Connect Google Classroom before listing assignments")

    creds = await _refresh_if_needed(connection, db)
    try:
        service = build("classroom", "v1", credentials=creds, cache_discovery=False)

        # Read every page so newly created courses are not silently missed.
        courses = []
        courses_page_token = None
        while True:
            courses_result = service.courses().list(
                courseStates=["ACTIVE"],
                pageSize=100,
                pageToken=courses_page_token,
            ).execute()
            courses.extend(courses_result.get("courses", []))
            courses_page_token = courses_result.get("nextPageToken")
            if not courses_page_token:
                break

        all_assignments: List[Dict[str, Any]] = []
        now_utc = datetime.now(timezone.utc)

        for course in courses:
            course_id = course["id"]
            course_name = course.get("name", "Unknown Course")
            try:
                coursework = []
                coursework_page_token = None
                while True:
                    cw_result = service.courses().courseWork().list(
                        courseId=course_id,
                        orderBy="dueDate asc",
                        pageSize=100,
                        pageToken=coursework_page_token,
                    ).execute()
                    coursework.extend(cw_result.get("courseWork", []))
                    coursework_page_token = cw_result.get("nextPageToken")
                    if not coursework_page_token:
                        break
            except Exception:
                continue

            # Fetch submission states for this course (readonly scope already granted)
            sub_by_work_id: dict = {}
            try:
                submissions_page_token = None
                while True:
                    subs_result = service.courses().courseWork().studentSubmissions().list(
                        courseId=course_id,
                        courseWorkId="-",
                        userId="me",
                        pageSize=100,
                        pageToken=submissions_page_token,
                    ).execute()
                    for sub in subs_result.get("studentSubmissions", []):
                        sub_by_work_id[sub["courseWorkId"]] = sub.get("state", "NEW")
                    submissions_page_token = subs_result.get("nextPageToken")
                    if not submissions_page_token:
                        break
            except Exception:
                pass

            for work in coursework:
                due_date = work.get("dueDate")
                due_time = work.get("dueTime")
                due_dt = None
                if due_date:
                    try:
                        due_dt = datetime(
                            year=due_date["year"],
                            month=due_date["month"],
                            day=due_date["day"],
                            hour=due_time.get("hours", 23) if due_time else 23,
                            minute=due_time.get("minutes", 59) if due_time else 59,
                            tzinfo=timezone.utc,
                        )
                    except Exception:
                        due_dt = None

                # Classify due status
                if due_dt is None:
                    due_status = "no_due_date"
                elif due_dt < now_utc:
                    due_status = "overdue"
                elif (due_dt - now_utc).days <= 3:
                    due_status = "due_soon"
                else:
                    due_status = "upcoming"

                all_assignments.append({
                    "id": work["id"],
                    "course_id": course_id,
                    "course_name": course_name,
                    "title": work.get("title", "Untitled"),
                    "description": work.get("description"),
                    "alternate_link": work.get("alternateLink"),
                    "due_date": due_dt.isoformat() if due_dt else None,
                    "due_status": due_status,
                    "max_points": work.get("maxPoints"),
                    "work_type": work.get("workType", "ASSIGNMENT"),
                    # NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
                    "submission_state": sub_by_work_id.get(work["id"], "NEW"),
                })

        # Defensive server-side deduplication by course + coursework ID.
        unique_assignments = {}
        for assignment in all_assignments:
            key = f"{assignment.get('course_id', '')}:{assignment.get('id', '')}"
            unique_assignments[key] = assignment

        return list(unique_assignments.values())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch assignments: {exc}")


@router.post("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_classroom(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await db.scalar(
        select(GoogleClassroomConnection).where(GoogleClassroomConnection.user_id == current_user.id)
    )
    if connection:
        await db.delete(connection)
        await db.commit()
    return None
