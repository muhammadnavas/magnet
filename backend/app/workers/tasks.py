import asyncio
import logging
import uuid
import os
import re
import random
import httpx
import pdfplumber
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.knowledge import KnowledgeItem, KnowledgeChunk, Tag
from app.models.project import Project
from app.models.conversation import ProcessingJob
from app.utils.ai import get_embedding, analyze_document

logger = logging.getLogger(__name__)

def extract_pdf_text(filepath: str) -> str:
    """Extract text pages from PDF using pdfplumber with fallback for plain text."""
    text = ""
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error(f"Error parsing PDF file at {filepath}: {e}")
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception as ex:
            logger.error(f"Fallback plain text read failed: {ex}")
    return text


async def extract_url_content(url: str) -> str:
    """Fetch URL response and strip HTML tags to retrieve raw body text."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                html = response.text
                html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
                html = re.sub(r'<style.*?</style>', '', html, flags=re.DOTALL)
                text = re.sub(r'<.*?>', ' ', html)
                text = re.sub(r'\s+', ' ', text)
                return text.strip()
    except Exception as e:
        logger.error(f"Error fetching URL content from {url}: {e}")
    return ""


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 120) -> list:
    """Split text into overlapping blocks of specified size."""
    chunks = []
    if not text:
        return chunks
    start = 0
    text_len = len(text)
    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        start += chunk_size - overlap
    return chunks


async def process_document(ctx, knowledge_id: str):
    """
    Process a KnowledgeItem and persist its searchable content.

    Uploaded files are backed by Google Drive when configured. The local
    uploads directory is only a processing cache, so a worker restart does
    not make a previously uploaded file inaccessible.
    """
    logger.info(f"Worker task started: processing knowledge item {knowledge_id}")
    knowledge_uuid = uuid.UUID(knowledge_id)

    async with async_session() as db:
        result = await db.execute(
            select(KnowledgeItem)
            .where(KnowledgeItem.id == knowledge_uuid)
            .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
        )
        item = result.scalars().first()
        if not item:
            logger.error(f"KnowledgeItem {knowledge_id} not found in database.")
            return {"status": "error", "message": "Item not found"}

        job_result = await db.execute(
            select(ProcessingJob).where(ProcessingJob.knowledge_id == knowledge_uuid)
        )
        job = job_result.scalars().first()
        if not job:
            job = ProcessingJob(knowledge_id=knowledge_uuid, status="processing", progress=10)
            db.add(job)
        else:
            job.status = "processing"
            job.progress = 10
        item.processing_status = "processing"
        await db.commit()

        text = ""
        temp_file_path = None
        try:
            # Local uploads are temporary. If the service restarted, restore
            # the durable Drive copy using the stored Drive file ID.
            target_path = item.file_path if item.file_path and os.path.exists(item.file_path) else None
            gdrive_file_id = (item.meta or {}).get("gdrive_file_id")

            if not target_path and gdrive_file_id:
                from app.services.gdrive import download_file_from_gdrive
                os.makedirs("uploads", exist_ok=True)
                extension = os.path.splitext(item.file_path or "")[1] or (
                    ".pdf" if item.content_type == "pdf" else ".jpg"
                )
                temp_file_path = f"uploads/{uuid.uuid4()}_temp{extension}"
                logger.info(
                    f"Restoring file {gdrive_file_id} from Google Drive to {temp_file_path}"
                )
                success = await asyncio.to_thread(
                    download_file_from_gdrive,
                    gdrive_file_id,
                    temp_file_path,
                )
                if success:
                    target_path = temp_file_path
                else:
                    logger.error("Failed to restore file from Google Drive for processing.")

            if item.content_type == "pdf" and target_path:
                job.progress = 20
                await db.commit()
                text = await asyncio.to_thread(extract_pdf_text, target_path)
            elif item.content_type == "url" and item.source_url:
                job.progress = 20
                await db.commit()
                text = await extract_url_content(item.source_url)
            else:
                # Images are stored durably and remain available for future
                # vision/OCR processing. Until an OCR provider is configured,
                # preserve the capture metadata as searchable raw content.
                text = item.raw_content or ""

            if not text and item.raw_content:
                text = item.raw_content

            item.extracted_text = text
            job.progress = 40
            await db.commit()

            if temp_file_path:
                try:
                    os.remove(temp_file_path)
                except OSError:
                    pass
        except Exception as e:
            logger.error(f"Error during document text extraction: {e}")
            job.status = "failed"
            job.error_message = f"Text extraction failed: {str(e)}"
            item.processing_status = "failed"
            await db.commit()
            return {"status": "failed", "error": str(e)}

        try:
            chunks = chunk_text(text)
            logger.info(f"Split document into {len(chunks)} chunks.")

            for idx, chunk_content in enumerate(chunks):
                embedding = await get_embedding(chunk_content)
                token_count = len(chunk_content.split())
                chunk = KnowledgeChunk(
                    knowledge_id=knowledge_uuid,
                    chunk_index=idx,
                    content=chunk_content,
                    embedding=embedding,
                    token_count=token_count,
                )
                db.add(chunk)

            job.progress = 70
            await db.commit()
        except Exception as e:
            logger.error(f"Error during text chunking/embeddings: {e}")
            job.status = "failed"
            job.error_message = f"Embeddings generation failed: {str(e)}"
            item.processing_status = "failed"
            await db.commit()
            return {"status": "failed", "error": str(e)}

        try:
            analysis = await analyze_document(text)
            item.summary = analysis.get("summary")
            item.key_points = analysis.get("key_points", [])

            meta = dict(item.meta or {})
            meta["technologies"] = analysis.get("technologies", [])
            item.meta = meta

            REDUNDANT_TAGS = {
                "imported", "pdf", "file", "doc", "text", "document", "url",
                "github", "image", "unknown", "screenshot", "code", "error"
            }
            for tag_name in analysis.get("tags", []):
                tag_name = tag_name.strip().lower()
                if not tag_name or tag_name in REDUNDANT_TAGS or tag_name == (item.content_type or "").lower():
                    continue
                tag_sel = await db.execute(select(Tag).where(Tag.name == tag_name))
                tag = tag_sel.scalars().first()
                if not tag:
                    color = f"#{random.randint(100,250):02X}{random.randint(100,250):02X}{random.randint(100,250):02X}"
                    tag = Tag(name=tag_name, color=color)
                    db.add(tag)
                    await db.flush()
                if tag not in item.tags:
                    item.tags.append(tag)

            job.progress = 90
            await db.commit()
        except Exception as e:
            logger.error(f"Error during document LLM analysis: {e}")
            item.summary = item.summary or text[:200]
            item.key_points = ["Processed document chunks successfully."]

        item.processing_status = "completed"
        job.status = "completed"
        job.progress = 100
        await db.commit()

        logger.info(f"Finished job process_document for {knowledge_id} successfully.")
        return {"status": "completed", "item_id": knowledge_id}
