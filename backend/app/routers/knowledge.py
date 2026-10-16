import os
import uuid
import logging
import re
import urllib.parse
import mimetypes
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
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
from app.workers.tasks import process_document
from app.services.personal_context import remove_knowledge_source, get_or_create_personal_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


@router.get("", response_model=List[KnowledgeItemOut])
async def list_knowledge(content_type: Optional[str] = None, project: Optional[str] = None, tag: Optional[str] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(KnowledgeItem).where(True).options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
    if content_type and content_type.lower() != "all":
        val = {"notes": "note", "pdfs": "pdf", "images": "image", "urls": "url", "errors": "error"}.get(content_type.lower(), content_type.lower())
        query = query.where(KnowledgeItem.content_type == val)
    if project and project.lower() != "all":
        query = query.join(KnowledgeItem.projects).where(Project.name == project)
    if tag and tag.lower() != "all":
        query = query.join(KnowledgeItem.tags).where(Tag.name == tag.lower())
    result = await db.execute(query.where(KnowledgeItem.is_archived == False).order_by(KnowledgeItem.created_at.desc()))
    return result.scalars().all()


@router.get("/personal-context")
async def get_legacy_personal_context(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Backward-compatible route for older mobile builds."""
    context = await get_or_create_personal_context(db)
    await db.commit()
    return {"context": context.context, "version": context.version, "updated_at": context.updated_at}


@router.post("/upload", response_model=KnowledgeItemOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge(title: str = Form("Untitled Item"), content_type: str = Form("note"), raw_content: Optional[str] = Form(None), project: Optional[str] = Form(None), tags: Optional[str] = Form(None), file: Optional[UploadFile] = File(None), background_tasks: BackgroundTasks = BackgroundTasks(), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    file_path = None
    gdrive_meta = {}

    if file:
        try:
            os.makedirs("uploads", exist_ok=True)
            file_path = f"uploads/{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
            with open(file_path, "wb") as f:
                f.write(await file.read())
            try:
                from app.services.gdrive import upload_file_to_gdrive
                gdrive_res = upload_file_to_gdrive(file_path, urllib.parse.unquote(file.filename), file.content_type)
                if "error" not in gdrive_res:
                    gdrive_meta = {"gdrive_file_id": gdrive_res.get("id"), "gdrive_web_view_link": gdrive_res.get("webViewLink"), "mime_type": file.content_type, "original_filename": urllib.parse.unquote(file.filename or "")}
            except Exception as ge:
                logger.warning(f"GDrive integration skipped: {ge}")
        except Exception as e:
            logger.error(f"Failed to save file: {e}")
            raise HTTPException(status_code=500, detail=f"Could not save file upload: {str(e)}")

    elif raw_content and raw_content.strip() and content_type.lower() in {"note", "code", "error"}:
        try:
            os.makedirs("uploads", exist_ok=True)
            safe_title = re.sub(r"[^A-Za-z0-9._ -]+", "", (title or "Untitled Item")).strip(" .") or "Untitled Item"
            if not safe_title.lower().endswith(".txt"):
                safe_title = f"{safe_title}.txt"
            file_path = f"uploads/{uuid.uuid4()}.txt"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(raw_content)

            try:
                from app.services.gdrive import upload_file_to_gdrive
                gdrive_res = upload_file_to_gdrive(file_path, safe_title, "text/plain")
                if "error" not in gdrive_res:
                    gdrive_meta = {"gdrive_file_id": gdrive_res.get("id"), "gdrive_web_view_link": gdrive_res.get("webViewLink")}
                else:
                    logger.warning(f"Text knowledge saved locally but GDrive upload failed: {gdrive_res.get('error')}")
            except Exception as ge:
                logger.warning(f"Text knowledge GDrive upload skipped: {ge}")
        except Exception as e:
            logger.error(f"Failed to create text knowledge file: {e}")
            raise HTTPException(status_code=500, detail=f"Could not save text knowledge: {str(e)}")

    new_item = KnowledgeItem(title=title, content_type=content_type.lower(), raw_content=raw_content, file_path=file_path, processing_status="pending", meta=gdrive_meta, projects=[], tags=[])
    db.add(new_item)
    await db.flush()

    if project and project.strip():
        project_name = project.strip()
        proj_sel = await db.execute(select(Project).where(Project.name == project_name))
        db_project = proj_sel.scalars().first()
        if not db_project:
            db_project = Project(name=project_name, status="active")
            db.add(db_project)
            await db.flush()
        new_item.projects.append(db_project)

    if tags and tags.strip():
        for tag_name in tags.split(","):
            tag_name = tag_name.strip().lower()
            if not tag_name:
                continue
            tag_sel = await db.execute(select(Tag).where(Tag.name == tag_name))
            db_tag = tag_sel.scalars().first()
            if not db_tag:
                import random
                db_tag = Tag(name=tag_name, color=f"#{random.randint(100,250):02X}{random.randint(100,250):02X}{random.randint(100,250):02X}")
                db.add(db_tag)
                await db.flush()
            if db_tag not in new_item.tags:
                new_item.tags.append(db_tag)

    db.add(ProcessingJob(knowledge_id=new_item.id, status="pending", progress=0))
    await db.commit()
    target_id = new_item.id
    background_tasks.add_task(process_document, None, str(target_id))
    res = await db.execute(select(KnowledgeItem).where(KnowledgeItem.id == target_id).options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects)))
    return res.scalars().first()


@router.get("/{id}/source")
async def get_knowledge_source(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Serve the original uploaded source inline for the in-app document viewer."""
    result = await db.execute(select(KnowledgeItem).where(KnowledgeItem.id == id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Resolve paths against the backend working directory as well as the
    # configured uploads directory. Relative paths can break after deployment
    # if the process starts from a different working directory.
    file_path = item.file_path
    if file_path and not os.path.isabs(file_path):
        candidates = [os.path.abspath(file_path), os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", file_path))]
        file_path = next((candidate for candidate in candidates if os.path.isfile(candidate)), candidates[0])

    if not file_path or not os.path.isfile(file_path):
        meta = item.meta or {}
        gdrive_file_id = meta.get("gdrive_file_id")
        if gdrive_file_id:
            # Preserve the original extension so Google Drive downloads remain
            # recognizable to MIME detection and PDF viewers.
            extension = os.path.splitext(item.title or "")[1]
            if not extension:
                extension = mimetypes.guess_extension(meta.get("mime_type") or "") or (".pdf" if item.content_type == "pdf" else "")
            uploads_dir = os.path.abspath("uploads")
            os.makedirs(uploads_dir, exist_ok=True)
            restored_path = os.path.join(uploads_dir, f"{uuid.uuid4()}{extension}")
            try:
                from app.services.gdrive import download_file_from_gdrive
                restored = download_file_from_gdrive(gdrive_file_id, restored_path)
                if restored and os.path.isfile(restored_path) and os.path.getsize(restored_path) > 0:
                    file_path = restored_path
                    # Cache the restored path so subsequent previews do not
                    # need to download the same document again.
                    item.file_path = file_path
                    await db.commit()
                else:
                    if os.path.exists(restored_path):
                        os.remove(restored_path)
                    file_path = None
            except Exception:
                logger.exception("Failed to restore source from Google Drive for knowledge item %s", id)
                if os.path.exists(restored_path):
                    try:
                        os.remove(restored_path)
                    except OSError:
                        pass
                file_path = None

    if not file_path or not os.path.isfile(file_path):
        logger.warning("Original source unavailable for knowledge item %s (type=%s)", id, item.content_type)
        raise HTTPException(status_code=404, detail="Original source is unavailable. The file may need to be uploaded again.")

    media_type = "application/pdf" if item.content_type == "pdf" else (mimetypes.guess_type(file_path)[0] or "application/octet-stream")
    if item.content_type == "image":
        media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    elif item.content_type in {"note", "code", "error"}:
        media_type = "text/plain"

    extension = os.path.splitext(file_path)[1] or (".pdf" if item.content_type == "pdf" else "")
    filename = os.path.basename(item.title or f"orio-source{extension}")
    if extension and not os.path.splitext(filename)[1]:
        filename = f"{filename}{extension}"

    try:
        return FileResponse(file_path, media_type=media_type, filename=filename, content_disposition_type="inline")
    except Exception:
        logger.exception("Could not serve original source for knowledge item %s", id)
        raise HTTPException(status_code=500, detail="Could not open the original source file.")


@router.get("/{id}", response_model=KnowledgeItemOut)
async def get_knowledge_item(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItem).where(KnowledgeItem.id == id).options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects)))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.patch("/{id}", response_model=KnowledgeItemOut)
async def update_knowledge_item(id: uuid.UUID, is_favorite: Optional[bool] = None, is_archived: Optional[bool] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItem).where(KnowledgeItem.id == id).options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects)))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if is_favorite is not None:
        item.is_favorite = is_favorite
    if is_archived is not None:
        item.is_archived = is_archived
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_item(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KnowledgeItem).where(KnowledgeItem.id == id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    gdrive_file_id = (item.meta or {}).get("gdrive_file_id")
    if gdrive_file_id:
        try:
            from app.services.gdrive import delete_file_from_gdrive
            if not delete_file_from_gdrive(gdrive_file_id):
                raise HTTPException(status_code=502, detail="Could not delete the knowledge source from Google Drive")
        except HTTPException:
            raise
        except Exception as ge:
            logger.error(f"Failed to delete Google Drive source {gdrive_file_id}: {ge}")
            raise HTTPException(status_code=502, detail="Could not delete the knowledge source from Google Drive")

    await remove_knowledge_source(db, id)
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.knowledge_id == id))
    await db.execute(delete(ProcessingJob).where(ProcessingJob.knowledge_id == id))
    await db.delete(item)
    await db.commit()
