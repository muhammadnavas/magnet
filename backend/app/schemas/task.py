import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    deadline: Optional[datetime] = None
    reminder_interval_hours: Optional[int] = 24

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None
    reminder_interval_hours: Optional[int] = None

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
