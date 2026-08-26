import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.project import Project
from app.schemas.knowledge import ProjectCreate, ProjectOut

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Project).where(Project.user_id == current_user.id).order_by(Project.name.asc())
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_project = Project(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        technologies=payload.technologies,
        github_url=payload.github_url,
        status=payload.status
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return new_project

@router.get("/{id}", response_model=ProjectOut)
async def get_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.id == id, Project.user_id == current_user.id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project

@router.patch("/{id}", response_model=ProjectOut)
async def update_project(
    id: uuid.UUID,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.id == id, Project.user_id == current_user.id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    project.name = payload.name
    project.description = payload.description
    project.technologies = payload.technologies
    project.github_url = payload.github_url
    project.status = payload.status
    
    await db.commit()
    await db.refresh(project)
    return project

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.id == id, Project.user_id == current_user.id)
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
