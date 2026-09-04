import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import BackgroundTasks

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.knowledge import KnowledgeItem, Tag
from app.models.project import Project
from app.models.conversation import ProcessingJob
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["Offline Synchronization"])

@router.post("", status_code=status.HTTP_200_OK)
async def process_sync_queue(
    queue: List[Dict[str, Any]],
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process batch sync queue from offline client:
    Format: [{"operation": "create"|"update"|"delete", "payload": {...}}]
    """
    processed_count = 0

    for idx, item_op in enumerate(queue):
        op = item_op.get("operation")
        payload = item_op.get("payload", {})
        
        try:
            if op == "create":
                title = payload.get("title", "Untitled Sync Item")
                content_type = payload.get("contentType", "note").lower()
                raw_content = payload.get("rawContent")
                project_name = payload.get("project")
                tag_list = payload.get("tags", [])
                
                new_item = KnowledgeItem(
                    
                    title=title,
                    content_type=content_type,
                    raw_content=raw_content,
                    processing_status="pending"
                )
                db.add(new_item)
                await db.flush()
                
                # Associate project
                if project_name and project_name.strip():
                    proj_sel = await db.execute(
                        select(Project).where(Project.name == project_name.strip())
                    )
                    db_project = proj_sel.scalars().first()
                    if not db_project:
                        db_project = Project(name=project_name.strip())
                        db.add(db_project)
                        await db.flush()
                    new_item.projects.append(db_project)
                    
                # Associate tags
                for tag_name in tag_list:
                    tag_name = tag_name.strip().lower()
                    if not tag_name:
                        continue
                    tag_sel = await db.execute(
                        select(Tag).where(Tag.name == tag_name)
                    )
                    db_tag = tag_sel.scalars().first()
                    if not db_tag:
                        import random
                        color = f"#{random.randint(100,250):02X}{random.randint(100,250):02X}{random.randint(100,250):02X}"
                        db_tag = Tag(name=tag_name, color=color)
                        db.add(db_tag)
                        await db.flush()
                    if db_tag not in new_item.tags:
                        new_item.tags.append(db_tag)

                # Seed job
                job = ProcessingJob(knowledge_id=new_item.id, status="pending", progress=0)
                db.add(job)
                await db.flush()

                # Dispatch worker task directly in the background
                background_tasks.add_task(process_document, None, str(new_item.id))
                    
                processed_count += 1
                
            elif op == "update":
                item_id_str = payload.get("id")
                if not item_id_str:
                    continue
                item_uuid = uuid.UUID(item_id_str)
                
                result = await db.execute(
                    select(KnowledgeItem).where(KnowledgeItem.id == item_uuid)
                )
                item = result.scalars().first()
                if item:
                    if "isFavorite" in payload:
                        item.is_favorite = payload["isFavorite"]
                    if "isArchived" in payload:
                        item.is_archived = payload["isArchived"]
                    processed_count += 1
                    
            elif op == "delete":
                item_id_str = payload.get("id")
                if not item_id_str:
                    continue
                item_uuid = uuid.UUID(item_id_str)
                
                result = await db.execute(
                    select(KnowledgeItem).where(KnowledgeItem.id == item_uuid)
                )
                item = result.scalars().first()
                if item:
                    await db.delete(item)
                    processed_count += 1
                    
        except Exception as e:
            logger.error(f"Failed to sync operation index {idx} ({op}): {e}")
            # Continue to next item in queue to be robust
            continue

    await db.commit()
    return {"status": "synced", "processed_count": processed_count}
