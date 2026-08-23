from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.knowledge import KnowledgeItemCreate, KnowledgeItemOut

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

@router.get("", response_model=List[KnowledgeItemOut])
async def list_knowledge(
    content_type: Optional[str] = None,
    project: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Returns empty list for Phase 1
    return []

@router.post("/upload", response_model=KnowledgeItemOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge(
    title: str = Form(...),
    content_type: str = Form(...),
    raw_content: Optional[str] = Form(None),
    project: Optional[str] = Form(None),
    tags: Optional[str] = Form(None), # Comma separated
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Scaffold response for Phase 1
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Knowledge upload ingestion pipeline will be fully wired in Phase 2."
    )

@router.get("/{id}", response_model=KnowledgeItemOut)
async def get_knowledge_item(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

@router.patch("/{id}", response_model=KnowledgeItemOut)
async def update_knowledge_item(
    id: uuid.UUID,
    is_favorite: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_item(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
