import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_validator

def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    deadline: Optional[datetime] = None
    reminder_interval_hours: Optional[int] = 24

    @field_validator("deadline", mode="after")
    @classmethod
    def validate_deadline(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _to_naive_utc(v)

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None
    reminder_interval_hours: Optional[int] = None

    @field_validator("deadline", mode="after")
    @classmethod
    def validate_deadline(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _to_naive_utc(v)

class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    deadline: Optional[datetime] = None
    reminder_interval_hours: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class TaskParseRequest(BaseModel):
    raw_text: str
    current_time: str

class TaskParseResponse(BaseModel):
    title: str
    priority: str
    deadline: Optional[datetime] = None
    reminder_interval_hours: int

    @field_validator("deadline", mode="after")
    @classmethod
    def validate_deadline(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _to_naive_utc(v)
