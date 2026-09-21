import json
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.knowledge import KnowledgeItem, Tag
from app.models.project import Project
from app.utils.ai import get_completion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["Insights"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Fetch recent knowledge items
        items_sel = await db.execute(
            select(KnowledgeItem.title, KnowledgeItem.summary, KnowledgeItem.content_type)
            .where(KnowledgeItem.is_archived == False)
            .order_by(KnowledgeItem.created_at.desc())
            .limit(10)
        )
        recent_items = items_sel.all()

        # 2. Fetch tags
        tag_sel = await db.execute(
            select(Tag.name)
            .join(KnowledgeItem.tags)
            .where(KnowledgeItem.is_archived == False)
        )
        tags_list = [r[0] for r in tag_sel.all()]

        # 3. Fetch projects
        proj_sel = await db.execute(
            select(Project.name).where(True)
        )
        projects_list = [r[0] for r in proj_sel.all()]

        if not recent_items:
            return [
                {
                    "id": "1",
                    "type": "summary",
                    "message": "Welcome to Magnet! Add your first note or document to unlock personalized AI insights."
                },
                {
                    "id": "2",
                    "type": "relation",
                    "message": "Upload code snippets or documents to map your technical knowledge graphs."
                },
                {
                    "id": "3",
                    "type": "review",
                    "message": "Create a project to organize tasks and developer notes in one workspace."
                }
            ]

        # Formulate LLM prompt to generate dynamic, intelligent insights
        items_summary = "\n".join([f"- Title: {title} | Type: {ctype} | Summary: {summary or 'N/A'}" for title, summary, ctype in recent_items])
        tags_summary = ", ".join(list(set(tags_list))[:10]) or "None"
        projects_summary = ", ".join(list(set(projects_list))[:5]) or "None"

        system_prompt = (
            "You are Magnet AI Insights Engine. Analyze the user's indexed developer knowledge base, tags, and projects "
            "and output a JSON array of 3 distinct, intelligent, personalized insights for their developer dashboard.\n\n"
            "JSON structure: An array of 3 objects, each with:\n"
            "- 'id' (str): '1', '2', '3'\n"
            "- 'type' (str): 'summary' (overall knowledge focus), 'relation' (topic connection/pattern), 'review' (strategic learning/project recommendation)\n"
            "- 'message' (str): A concise, engaging 1-2 sentence insight synthesized intelligently.\n\n"
            "Output ONLY valid JSON — no markdown fences or extra commentary."
        )

        user_prompt = (
            f"Indexed Knowledge Items ({len(recent_items)} recent):\n{items_summary}\n\n"
            f"Active Topics/Tags: {tags_summary}\n"
            f"Active Projects: {projects_summary}"
        )

        raw = await get_completion(system_prompt, user_prompt)
        cleaned = raw.strip()
        for prefix in ("```json", "```"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        insights_data = json.loads(cleaned)
        if isinstance(insights_data, list) and len(insights_data) >= 1:
            return insights_data

    except Exception as e:
        logger.error(f"Error compiling LLM insights: {e}")

    # Fallback if DB is empty or LLM errors
    return [
        {
            "id": "1",
            "type": "summary",
            "message": "Your Magnet knowledge base is indexed and ready for AI synthesis."
        },
        {
            "id": "2",
            "type": "relation",
            "message": "Query Magnet Chat to discover connections across your notes."
        },
        {
            "id": "3",
            "type": "review",
            "message": "Keep adding technical notes and code snippets to sharpen your knowledge graph."
        }
    ]
