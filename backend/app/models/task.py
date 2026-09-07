import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum

class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class TaskStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(String(2048), nullable=True)
    priority: Mapped[str] = mapped_column(SAEnum(TaskPriority, name="task_priority"), default=TaskPriority.medium, nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(TaskStatus, name="task_status"), default=TaskStatus.pending, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reminder_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    reminder_interval_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
