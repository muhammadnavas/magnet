import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskOut])
async def list_tasks(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Task).where(Task.user_id == current_user.id)
    if status_filter and status_filter in ("pending", "completed"):
        query = query.where(Task.status == status_filter)
    query = query.order_by(Task.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = Task(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority or "medium",
        deadline=payload.deadline,
        reminder_interval_hours=payload.reminder_interval_hours or 24,
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.deadline is not None:
        task.deadline = payload.deadline
    if payload.reminder_interval_hours is not None:
        task.reminder_interval_hours = payload.reminder_interval_hours
    if payload.status is not None:
        task.status = payload.status
        if payload.status == "completed" and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        elif payload.status == "pending":
            task.completed_at = None

    task.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await db.delete(task)
    await db.commit()
