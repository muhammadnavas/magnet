from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.knowledge import ProjectCreate, ProjectOut

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return []

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Scaffold for Phase 1
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Project manager database links will be fully implemented in Phase 4."
    )

@router.get("/{id}", response_model=ProjectOut)
async def get_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

@router.patch("/{id}", response_model=ProjectOut)
async def update_project(
    id: uuid.UUID,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
