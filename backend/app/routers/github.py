import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from urllib.parse import urlencode

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.github import GitHubConnection
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User

router = APIRouter(prefix="/github", tags=["GitHub Integration"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"
OAUTH_STATE_TTL_MINUTES = 10


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


def _make_state(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "purpose": "github_oauth",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=OAUTH_STATE_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _validate_state(state: str, user_id: uuid.UUID) -> None:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired GitHub OAuth state") from exc
    if payload.get("purpose") != "github_oauth" or payload.get("sub") != str(user_id):
        raise HTTPException(status_code=400, detail="Invalid GitHub OAuth state")


def _user_id_from_state(state: str) -> uuid.UUID:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("purpose") != "github_oauth":
            raise ValueError
        return uuid.UUID(payload["sub"])
    except (JWTError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired GitHub OAuth state") from exc


async def _github_request(token: str, path: str, **kwargs: Any) -> httpx.Response:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        return await client.get(f"{GITHUB_API_URL}{path}", headers=headers, **kwargs)


async def _exchange_and_store(code: str, state: str, db: AsyncSession) -> str:
    user_id = _user_id_from_state(state)
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET or not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on the backend")

    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub token exchange failed")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail=token_data.get("error_description", "GitHub authorization failed"))

    user_response = await _github_request(access_token, "/user")
    if user_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not read the GitHub account")

    github_user = user_response.json()
    github_user_id = github_user.get("id")
    github_username = github_user.get("login")
    if not github_user_id or not github_username:
        raise HTTPException(status_code=502, detail="GitHub returned an incomplete user profile")

    existing = await db.scalar(select(GitHubConnection).where(GitHubConnection.user_id == user_id))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if existing:
        existing.github_user_id = github_user_id
        existing.github_username = github_username
        existing.access_token = _encrypt_token(access_token)
        existing.scope = token_data.get("scope")
        existing.updated_at = now
    else:
        db.add(
            GitHubConnection(
                user_id=user_id,
                github_user_id=github_user_id,
                github_username=github_username,
                access_token=_encrypt_token(access_token),
                scope=token_data.get("scope"),
                connected_at=now,
                updated_at=now,
            )
        )
    await db.commit()
    return github_username


@router.get("/authorize", status_code=status.HTTP_200_OK)
async def github_authorize(current_user: User = Depends(get_current_user)):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on the backend")

    state = _make_state(current_user.id)
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "read:user repo",
        "state": state,
        "allow_signup": "false",
    }
    return {"authorization_url": f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"}


@router.get("/callback")
async def github_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{settings.GITHUB_APP_REDIRECT_URI}?connected=false&error={urlencode({'error': error})[6:]}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing GitHub OAuth code or state")

    username = await _exchange_and_store(code, state, db)
    query = urlencode({"connected": "true", "username": username})
    return RedirectResponse(f"{settings.GITHUB_APP_REDIRECT_URI}?{query}")


@router.post("/connect", status_code=status.HTTP_200_OK)
async def connect_github(
    code: str,
    state: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_state(state, current_user.id)
    username = await _exchange_and_store(code, state, db)
    return {"connected": True, "username": username}


@router.get("/status", status_code=status.HTTP_200_OK)
async def github_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await db.scalar(select(GitHubConnection).where(GitHubConnection.user_id == current_user.id))
    if not connection:
        return {"connected": False}
    return {"connected": True, "username": connection.github_username}


@router.get("/repos", response_model=List[Dict[str, Any]])
async def list_github_repositories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await db.scalar(select(GitHubConnection).where(GitHubConnection.user_id == current_user.id))
    if not connection:
        raise HTTPException(status_code=409, detail="Connect GitHub before listing repositories")

    token = _decrypt_token(connection.access_token)
    response = await _github_request(
        token,
        "/user/repos",
        params={
            "visibility": "all",
            "affiliation": "owner,collaborator,organization_member",
            "sort": "updated",
            "direction": "desc",
            "per_page": 100,
        },
    )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub authorization has expired or been revoked")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch GitHub repositories")

    return [
        {
            "id": repo["id"],
            "name": repo["name"],
            "full_name": repo["full_name"],
            "private": repo["private"],
            "description": repo.get("description"),
            "default_branch": repo.get("default_branch", "main"),
            "html_url": repo.get("html_url"),
            "updated_at": repo.get("updated_at"),
        }
        for repo in response.json()
    ]


@router.post("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_github(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await db.scalar(select(GitHubConnection).where(GitHubConnection.user_id == current_user.id))
    if connection:
        await db.delete(connection)
        await db.commit()
    return None


@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
async def import_github_content(
    repo_name: str,
    files: List[str],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Repository import will be enabled after GitHub connection and repository selection are wired to the ARQ pipeline.",
    )
