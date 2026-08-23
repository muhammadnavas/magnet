from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, UserOut, Token, TokenRefresh
from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login-form-fallback")

async def get_current_user(
    db: AsyncSession = Depends(get_db)
) -> User:
    email = "personal-app@orio.local"
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if user is None:
        user = User(
            email=email,
            hashed_password=get_password_hash("mocked-unused-password"),
            full_name="Navas",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
    return user

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create new user
    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Generate tokens
    access_token = create_access_token(new_user.id)
    refresh_token = create_refresh_token(new_user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(new_user)
    )

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_credentials.email))
    user = result.scalars().first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user)
    )

@router.post("/refresh", response_model=Token)
async def refresh_tokens(refresh_in: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_in.refresh_token)
    user_id_str = payload.get("sub")
    token_type = payload.get("type")
    
    if user_id_str is None or token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
        )
        
    try:
        import uuid
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_418_IM_A_TEAPOT,
            detail="Malformed token user ID."
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    # Generate new tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=UserOut)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
