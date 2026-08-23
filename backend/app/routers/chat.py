from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.chat import MessageCreate, MessageOut, ConversationOut

router = APIRouter(tags=["AI Chat (RAG)"])

@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return []

@router.post("/chat", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def ask_chat(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Scaffold message out for Phase 1
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="AI RAG Chat streaming and context injection will be wired in Phase 3."
    )

@router.get("/conversations/{id}/messages", response_model=List[MessageOut])
async def get_messages(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return []
