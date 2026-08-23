from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.knowledge import KnowledgeItemOut

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("", response_model=List[KnowledgeItemOut])
async def search_keyword(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Keyword search scaffold returns empty list
    return []

@router.post("/semantic", response_model=List[KnowledgeItemOut])
async def search_semantic(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Vector similarity search scaffold returns empty list
    return []
