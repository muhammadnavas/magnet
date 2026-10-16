"""Single-user personal mode.

Magnet does not manage accounts. All requests operate as the one local personal
profile; deployment access must be restricted because API authentication is disabled.
"""
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter
from app.schemas.auth import UserOut

router = APIRouter(prefix="/auth", tags=["Personal Profile"])

PERSONAL_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_current_user() -> UserOut:
    """Compatibility dependency for existing routers; no login/token required."""
    return UserOut(
        id=PERSONAL_USER_ID,
        email="personal@magnet.local",
        full_name="Personal User",
        is_active=True,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


@router.get("/me", response_model=UserOut)
async def read_current_user() -> UserOut:
    return get_current_user()
