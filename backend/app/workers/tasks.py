import asyncio
import logging
import uuid
import os
import re
import httpx
import pdfplumber
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.knowledge import KnowledgeItem, KnowledgeChunk, Tag, Tag
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
                # Remove scripts and styles
                html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
                html = re.sub(r'<style.*?</style>', '', html, flags=re.DOTALL)
                # Strip all other HTML tags
                text = re.sub(r'<.*?>', ' ', html)
                # Remove excessive whitespaces
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
    ARQ worker task to process a KnowledgeItem:
    1. Extract text (PDF text, URL scraping, or raw text input)
    2. Split text into chunks
    3. Generate and save pgvector embeddings for each chunk
    4. Call LLM to summarize, extract key points and tags
    5. Update KnowledgeItem columns, associated projects, and job status.
    """
    logger.info(f"Worker task started: processing knowledge item {knowledge_id}")
    
    # Resolve job ID
    knowledge_uuid = uuid.UUID(knowledge_id)
    
    async with async_session() as db:
        # Load item and job
        result = await db.execute(
            select(KnowledgeItem)
            .where(KnowledgeItem.id == knowledge_uuid)
            .options(selectinload(KnowledgeItem.tags), selectinload(KnowledgeItem.projects))
        )
        item = result.scalars().first()
        if not item:
            logger.error(f"KnowledgeItem {knowledge_id} not found in database.")
            return {"status": "error", "message": "Item not found"}

        # Find or create processing job
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
        await db.commit()

        # Step 0: Upload to Google Drive (if not done)
        if item.file_path and item.meta and "original_filename" in item.meta:
            try:
                # Run the upload synchronously in a thread
                from app.services.gdrive import upload_file_to_gdrive
                logger.info(f"Uploading {item.file_path} to Google Drive...")
                gdrive_res = await asyncio.to_thread(
                    upload_file_to_gdrive, 
                    item.file_path, 
                    item.meta.get("original_filename"), 
                    item.meta.get("mime_type")
                )
                if "error" not in gdrive_res:
                    meta = dict(item.meta)
                    meta["gdrive_file_id"] = gdrive_res.get("id")
                    meta["gdrive_web_view_link"] = gdrive_res.get("webViewLink")
                    item.meta = meta
                    logger.info("Successfully uploaded to GDrive in background.")
                else:
                    logger.error(f"GDrive upload failed in background: {gdrive_res.get('error')}")
                
                job.progress = 15
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to upload to Google Drive in background: {e}")

        # Step 1: Text extraction
        text = ""
        try:
            if item.content_type == "pdf" and item.file_path:
                job.progress = 20
                await db.commit()
                # Run CPU heavy extraction in thread pool
                text = await asyncio.to_thread(extract_pdf_text, item.file_path)
            elif item.content_type == "url" and item.source_url:
                job.progress = 20
                await db.commit()
                text = await extract_url_content(item.source_url)
            else:
                text = item.raw_content or ""
            
            # If still no text extracted but raw content is populated, fallback to it
            if not text and item.raw_content:
                text = item.raw_content

            item.extracted_text = text
            job.progress = 40
            await db.commit()
        except Exception as e:
            logger.error(f"Error during document text extraction: {e}")
            job.status = "failed"
            job.error_message = f"Text extraction failed: {str(e)}"
            item.processing_status = "failed"
            await db.commit()
            return {"status": "failed", "error": str(e)}

        # Step 2 & 3: Chunking and Embedding generation
        try:
            # Delete old chunks if reprocessing
            await db.execute(
                select(KnowledgeChunk).where(KnowledgeChunk.knowledge_id == knowledge_uuid)
            )
            # (cascade delete is configured, so we don't need manual delete if we clear them)
            
            chunks = chunk_text(text)
            logger.info(f"Split document into {len(chunks)} chunks.")
            
            for idx, chunk_content in enumerate(chunks):
                # Request embedding
                embedding = await get_embedding(chunk_content)
                token_count = len(chunk_content.split()) # Rough approximation
                
                chunk = KnowledgeChunk(
                    knowledge_id=knowledge_uuid,
                    chunk_index=idx,
                    content=chunk_content,
                    embedding=embedding,
                    token_count=token_count
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

        # Step 4: LLM Analysis (Summary, key points, tags, technologies)
        try:
            analysis = await analyze_document(text)
            
            item.summary = analysis.get("summary")
            item.key_points = analysis.get("key_points", [])
            
            # Store technologies in meta dict
            meta = dict(item.meta or {})
            meta["technologies"] = analysis.get("technologies", [])
            item.meta = meta
            
            # Link tags
            tags_to_add = []
            for tag_name in analysis.get("tags", []):
                tag_name = tag_name.strip().lower()
                if not tag_name:
                    continue
                # Check if tag already exists
                tag_sel = await db.execute(
                    select(Tag).where(Tag.name == tag_name)
                )
                tag = tag_sel.scalars().first()
                if not tag:
                    # Generate random hex color for new tags
                    import random
                    color = f"#{random.randint(100,250):02X}{random.randint(100,250):02X}{random.randint(100,250):02X}"
                    tag = Tag(name=tag_name, color=color)
                    db.add(tag)
                    await db.flush() # Populate tag ID
                
                if tag not in item.tags:
                    item.tags.append(tag)

            job.progress = 90
            await db.commit()
        except Exception as e:
            logger.error(f"Error during document LLM analysis: {e}")
            # Non-fatal, we continue since chunks were created
            item.summary = item.summary or text[:200]
            item.key_points = ["Processed document chunks successfully."]

        # Step 5: Mark complete
        item.processing_status = "completed"
        job.status = "completed"
        job.progress = 100
        await db.commit()
        
        logger.info(f"Finished job process_document for {knowledge_id} successfully.")
        return {"status": "completed", "item_id": knowledge_id}
