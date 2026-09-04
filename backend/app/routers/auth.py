from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.schemas.auth import UserRegister, UserLogin, UserOut, Token, TokenRefresh

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Hardcoded user ID
MOCK_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")

def get_mock_user() -> UserOut:
    return UserOut(
        id=MOCK_USER_ID,
        email="personal@orio.app",
        full_name="Personal User",
        is_active=True,
        created_at=datetime.now(timezone.utc)
    )

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserOut:
    # Accept any token and return the mock user
    return get_mock_user()

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister):
    # Accept anything
    user = get_mock_user()
    return Token(
        access_token="mock_access_token",
        refresh_token="mock_refresh_token",
        user=user
    )

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    # Accept anything
    user = get_mock_user()
    return Token(
        access_token="mock_access_token",
        refresh_token="mock_refresh_token",
        user=user
    )

@router.post("/refresh", response_model=Token)
async def refresh_tokens(refresh_in: TokenRefresh):
    user = get_mock_user()
    return Token(
        access_token="mock_access_token",
        refresh_token="mock_refresh_token",
        user=user
    )

@router.get("/me", response_model=UserOut)
async def read_current_user(current_user: UserOut = Depends(get_current_user)):
    return current_user
