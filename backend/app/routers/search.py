import logging
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.knowledge import KnowledgeItem, KnowledgeChunk
from app.schemas.knowledge import KnowledgeItemOut
from app.utils.ai import get_embedding

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("", response_model=List[KnowledgeItemOut])
async def search_keyword(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(KnowledgeItem)
        .where(
            KnowledgeItem.user_id == current_user.id,
            KnowledgeItem.is_archived == False,
            or_(
                KnowledgeItem.title.ilike(f"%{q}%"),
                KnowledgeItem.raw_content.ilike(f"%{q}%"),
                KnowledgeItem.extracted_text.ilike(f"%{q}%"),
                KnowledgeItem.summary.ilike(f"%{q}%")
            )
        )
        .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
        .order_by(KnowledgeItem.created_at.desc())
        .limit(20)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/semantic", response_model=List[KnowledgeItemOut])
async def search_semantic(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Generate query embedding
        query_embedding = await get_embedding(q)
        
        # Get chunks sorted by similarity
        chunks_sel = await db.execute(
            select(KnowledgeChunk)
            .join(KnowledgeChunk.item)
            .where(
                KnowledgeItem.user_id == current_user.id,
                KnowledgeItem.is_archived == False,
                KnowledgeItem.processing_status == "completed"
            )
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
            .limit(15)
            .options(
                selectinload(KnowledgeChunk.item).selectinload(KnowledgeItem.tags),
                selectinload(KnowledgeChunk.item).selectinload(KnowledgeItem.projects)
            )
        )
        chunks = chunks_sel.scalars().all()
        
        # Collate unique items
        items = []
        seen = set()
        for chunk in chunks:
            if chunk.item.id not in seen:
                seen.add(chunk.item.id)
                items.append(chunk.item)
                
        return items
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        # Fallback to keyword search on failure
        return await search_keyword(q=q, current_user=current_user, db=db)
