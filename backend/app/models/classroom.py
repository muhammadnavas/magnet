import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GoogleClassroomConnection(Base):
    __tablename__ = "google_classroom_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, index=True, nullable=False)
    google_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    google_email: Mapped[str] = mapped_column(String(512), nullable=False)
    # AES-GCM encrypted tokens (hex-encoded nonce + ciphertext)
    access_token: Mapped[str] = mapped_column(String(4096), nullable=False)
    refresh_token: Mapped[str] = mapped_column(String(4096), nullable=True)
    token_expiry: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
