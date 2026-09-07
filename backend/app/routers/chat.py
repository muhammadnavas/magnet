import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.conversation import Conversation, Message
from app.models.knowledge import KnowledgeChunk, KnowledgeItem
from app.schemas.chat import MessageCreate, MessageOut, ConversationOut
from app.utils.ai import get_embedding, get_completion

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Chat (RAG)"])

# A cosine distance below this value is considered a relevant semantic match.
# pgvector cosine similarity = 1 - cosine distance.
RAG_MATCH_DISTANCE_THRESHOLD = 0.55
RAG_CANDIDATE_LIMIT = 8

@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Authentication is currently mock-based and the current database schema
    # intentionally has no users table / conversation.user_id column.
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()

@router.post("/chat", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def ask_chat(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Resolve or create a conversation using the current schema.
    conv = None
    if payload.conversation_id:
        conv_sel = await db.execute(
            select(Conversation).where(Conversation.id == payload.conversation_id)
        )
        conv = conv_sel.scalars().first()

    if not conv:
        words = payload.content.split()
        title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        conv = Conversation(title=title)
        db.add(conv)
        await db.flush()

    # 2. Store user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.content,
        sources=[]
    )
    db.add(user_msg)
    await db.flush()

    # 3. RAG: retrieve only genuinely relevant chunks using pgvector.
    context_text = ""
    sources = []
    try:
        query_embedding = await get_embedding(payload.content)

        chunks_sel = await db.execute(
            select(
                KnowledgeChunk,
                KnowledgeChunk.embedding.cosine_distance(query_embedding).label("distance")
            )
            .join(KnowledgeChunk.item)
            .where(
                KnowledgeItem.is_archived == False,
                KnowledgeItem.processing_status == "completed"
            )
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
            .limit(RAG_CANDIDATE_LIMIT)
            .options(selectinload(KnowledgeChunk.item))
        )

        matched_chunks = []
        for chunk, distance in chunks_sel.all():
            # cosine distance is lower for better matches.
            if distance is not None and float(distance) <= RAG_MATCH_DISTANCE_THRESHOLD:
                matched_chunks.append(chunk)

        context_parts = []
        seen_items = set()
        for chunk in matched_chunks:
            context_parts.append(
                f"Source Document: {chunk.item.title} (Type: {chunk.item.content_type})\n"
                f"Document Summary: {chunk.item.summary or 'No summary available.'}\n"
                f"Snippet:\n{chunk.content}"
            )
            if chunk.item.id not in seen_items:
                seen_items.add(chunk.item.id)
                sources.append({
                    "id": str(chunk.item.id),
                    "title": chunk.item.title,
                    "type": chunk.item.content_type
                })

        if context_parts:
            context_text = "\n\n---\n\n".join(context_parts)

        logger.info(
            "RAG matched %d/%d candidate chunks across %d source documents",
            len(matched_chunks),
            RAG_CANDIDATE_LIMIT,
            len(sources),
        )
    except Exception as e:
        logger.error(f"Error during RAG context retrieval: {e}")

    # 4. Fetch recent conversation history
    history = []
    try:
        hist_sel = await db.execute(
            select(Message)
            .where(
                Message.conversation_id == conv.id,
                Message.id != user_msg.id
            )
            .order_by(Message.created_at.desc())
            .limit(6)
        )
        recent_msgs = list(reversed(hist_sel.scalars().all()))
        history = [{"role": m.role, "content": m.content} for m in recent_msgs]
    except Exception as e:
        logger.warning(f"Failed to fetch conversation history: {e}")

    system_prompt = (
        "You are Orio, a fast, highly concise developer co-pilot and AI companion.\n\n"
        "CRITICAL INSTRUCTIONS FOR RESPONSE LENGTH:\n"
        "1. BE CONCISE AND DIRECT. Keep responses short, crisp, and to the point (typically 2-4 sentences max or brief bullet points).\n"
        "2. NEVER output long, wordy explanations, unnecessary background context, or verbose introductions unless explicitly requested.\n"
        "3. DO NOT copy-paste raw document fields or list contact details/resumes line-by-line.\n"
        "4. Synthesize retrieved context cleanly into a direct answer to the user's query.\n"
        "5. Use compact Markdown formatting for code snippets or commands.\n"
        "6. If retrieved context is missing, give a short, direct answer.\n\n"
        f"Retrieved Knowledge Context from Orio Database:\n{context_text if context_text else '[No matching knowledge snippets found in Orio]'}"
    )

    try:
        ai_reply = await get_completion(system_prompt, payload.content, history=history)
    except Exception as e:
        logger.error(f"Error during LLM response generation: {e}")
        ai_reply = f"Error generating response: {str(e)}"

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=ai_reply,
        sources=sources
    )
    db.add(assistant_msg)

    conv.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg

@router.get("/conversations/{id}/messages", response_model=List[MessageOut])
async def get_messages(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv_sel = await db.execute(
        select(Conversation).where(Conversation.id == id)
    )
    conv = conv_sel.scalars().first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )

    query = (
        select(Message)
        .where(Message.conversation_id == id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()
