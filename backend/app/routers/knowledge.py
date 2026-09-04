import os
import uuid
import logging
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from sqlalchemy import delete
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.knowledge import KnowledgeItem, KnowledgeChunk, Tag
from app.models.project import Project
from app.models.conversation import ProcessingJob
from app.schemas.knowledge import KnowledgeItemOut
from app.config import settings
from app.workers.tasks import process_document


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

@router.get("", response_model=List[KnowledgeItemOut])
async def list_knowledge(
    content_type: Optional[str] = None,
    project: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(KnowledgeItem).where(True).options(
        selectinload(KnowledgeItem.tags),
        selectinload(KnowledgeItem.projects)
    )
    
    if content_type and content_type.lower() != "all":
        # Handle simple pluralization matching
        val = content_type.lower()
        if val == "notes":
            val = "note"
        elif val == "pdfs":
            val = "pdf"
        elif val == "images":
            val = "image"
        elif val == "urls":
            val = "url"
        elif val == "errors":
            val = "error"
        query = query.where(KnowledgeItem.content_type == val)
        
    if project and project.lower() != "all":
        query = query.join(KnowledgeItem.projects).where(Project.name == project)
        
    if tag and tag.lower() != "all":
        query = query.join(KnowledgeItem.tags).where(Tag.name == tag.lower())
        
    query = query.where(KnowledgeItem.is_archived == False)
    query = query.order_by(KnowledgeItem.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/upload", response_model=KnowledgeItemOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge(
    title: str = Form("Untitled Item"),
    content_type: str = Form("note"),
    raw_content: Optional[str] = Form(None),
    project: Optional[str] = Form(None),
    tags: Optional[str] = Form(None), # Comma separated
    file: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),

    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    file_path = None
    gdrive_meta = {}
    if file:
        try:
            os.makedirs("uploads", exist_ok=True)
            file_ext = os.path.splitext(file.filename)[1]
            file_path = f"uploads/{uuid.uuid4()}{file_ext}"
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
                
            # Upload to Google Drive
            import urllib.parse
            decoded_filename = urllib.parse.unquote(file.filename)
            from app.services.gdrive import upload_file_to_gdrive
            gdrive_res = upload_file_to_gdrive(file_path, decoded_filename, file.content_type)
            if "error" not in gdrive_res:
                gdrive_meta = {
                    "gdrive_file_id": gdrive_res.get("id"),
                    "gdrive_web_view_link": gdrive_res.get("webViewLink")
                }
            else:
                logger.error(f"GDrive upload failed: {gdrive_res.get('error')}")

            # Delete the local file to save space, background task will fetch from drive
            try:
                os.remove(file_path)
                file_path = None
            except OSError:
                pass

        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not save file upload: {str(e)}"
            )

    new_item = KnowledgeItem(
        
        title=title,
        content_type=content_type.lower(),
        raw_content=raw_content,
        file_path=file_path,
        processing_status="pending",
        meta=gdrive_meta,
        projects=[],
        tags=[]
    )

    db.add(new_item)
    await db.flush() # Populate ID


    # Associate Project if specified
    if project and project.strip():
        project_name = project.strip()
        proj_sel = await db.execute(
            select(Project).where(Project.name == project_name)
        )
        db_project = proj_sel.scalars().first()
        if not db_project:
            db_project = Project(name=project_name, status="active")
            db.add(db_project)
            await db.flush()
        new_item.projects.append(db_project)

    # Associate Tags if specified
    if tags and tags.strip():
        for tag_name in tags.split(","):
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

    # Seed processing job record
    job = ProcessingJob(knowledge_id=new_item.id, status="pending", progress=0)
    db.add(job)
    await db.commit()

    target_id = new_item.id

    # Trigger background worker task directly in the background
    background_tasks.add_task(process_document, None, str(target_id))

    # Retrieve fully populated response
    res = await db.execute(
        select(KnowledgeItem)
        .where(KnowledgeItem.id == target_id)
        .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
    )
    return res.scalars().first()


@router.get("/{id}", response_model=KnowledgeItemOut)
async def get_knowledge_item(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KnowledgeItem)
        .where(KnowledgeItem.id == id)
        .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item

@router.patch("/{id}", response_model=KnowledgeItemOut)
async def update_knowledge_item(
    id: uuid.UUID,
    is_favorite: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KnowledgeItem)
        .where(KnowledgeItem.id == id)
        .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    
    if is_favorite is not None:
        item.is_favorite = is_favorite
    if is_archived is not None:
        item.is_archived = is_archived
        
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_item(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KnowledgeItem)
        .where(KnowledgeItem.id == id)
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
        
    # Explicitly delete all chunks/embeddings and jobs associated with this knowledge item
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.knowledge_id == id))
    await db.execute(delete(ProcessingJob).where(ProcessingJob.knowledge_id == id))
    
    await db.delete(item)
    await db.commit()
