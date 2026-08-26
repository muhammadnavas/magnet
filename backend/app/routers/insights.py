import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.knowledge import KnowledgeItem, Tag
from app.models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["Insights"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Fetch total items count
        cnt_sel = await db.execute(
            select(func.count(KnowledgeItem.id)).where(KnowledgeItem.user_id == current_user.id)
        )
        total_items = cnt_sel.scalar() or 0

        # 2. Fetch tags count
        tag_sel = await db.execute(
            select(Tag.name, func.count(KnowledgeItem.id))
            .join(KnowledgeItem.tags)
            .where(KnowledgeItem.user_id == current_user.id)
            .group_by(Tag.name)
        )
        tags_counts = tag_sel.all()

        # 3. Fetch projects count
        proj_sel = await db.execute(
            select(func.count(Project.id)).where(Project.user_id == current_user.id)
        )
        proj_count = proj_sel.scalar() or 0

        insights = []
        
        # summary message
        insights.append({
            "id": "1",
            "type": "summary",
            "message": f"You have {total_items} developer notes and files indexed in your pgvector brain."
        })

        # relation message
        if tags_counts:
            # Sort tags by item count descending
            sorted_tags = sorted(list(tags_counts), key=lambda x: x[1], reverse=True)
            top_tag, top_count = sorted_tags[0]
            insights.append({
                "id": "2",
                "type": "relation",
                "message": f"Your most active topic is '{top_tag}' with {top_count} items linked."
            })
        else:
            insights.append({
                "id": "2",
                "type": "relation",
                "message": "Start adding tags (e.g. #docker, #fastapi) to map your knowledge graphs."
            })

        # projects message
        if proj_count > 0:
            insights.append({
                "id": "3",
                "type": "review",
                "message": f"Analyzing code patterns across your {proj_count} tracked projects."
            })
        else:
            insights.append({
                "id": "3",
                "type": "review",
                "message": "No active projects found. Link notes to a project to see smart connections."
            })

        return insights
    except Exception as e:
        logger.error(f"Error compiling database insights: {e}")
        # Graceful fallback to static list if database is empty/errors
        return [
            {
                "id": "1",
                "type": "summary",
                "message": "Orio database is spinning up. Start indexing files to compile statistics."
            }
        ]
