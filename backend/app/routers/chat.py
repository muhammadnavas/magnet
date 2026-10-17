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
from app.services.personal_context import get_or_create_personal_context

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Chat (RAG)"])
RAG_MATCH_DISTANCE_THRESHOLD = 0.55
RAG_CANDIDATE_LIMIT = 8


@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    return result.scalars().all()


@router.post("/chat", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def ask_chat(payload: MessageCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conv = None
    if payload.conversation_id:
        conv_sel = await db.execute(select(Conversation).where(Conversation.id == payload.conversation_id))
        conv = conv_sel.scalars().first()
    if not conv:
        words = payload.content.split()
        conv = Conversation(title=" ".join(words[:5]) + ("..." if len(words) > 5 else ""))
        db.add(conv)
        await db.flush()

    user_msg = Message(conversation_id=conv.id, role="user", content=payload.content, sources=[])
    db.add(user_msg)
    await db.flush()

    # Optional context/retrieval work runs inside savepoints. If a provider,
    # vector query, or context lookup fails, SQLAlchemy rolls back only that
    # failed operation instead of poisoning the outer transaction.
    personal_context = ""
    try:
        async with db.begin_nested():
            context = await get_or_create_personal_context(db)
            personal_context = context.context
    except Exception as e:
        logger.warning(f"Personal context unavailable: {e}")

    context_text = ""
    sources = []
    try:
        async with db.begin_nested():
            query_embedding = await get_embedding(payload.content)
            chunks_sel = await db.execute(
                select(KnowledgeChunk, KnowledgeChunk.embedding.cosine_distance(query_embedding).label("distance"))
                .join(KnowledgeChunk.item)
                .where(KnowledgeItem.is_archived == False, KnowledgeItem.processing_status == "completed")
                .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
                .limit(RAG_CANDIDATE_LIMIT)
                .options(selectinload(KnowledgeChunk.item))
            )
            matched_chunks = [
                (chunk, float(distance))
                for chunk, distance in chunks_sel.all()
                if distance is not None and float(distance) <= RAG_MATCH_DISTANCE_THRESHOLD
            ]
            context_parts = []
            seen_items = set()
            for chunk, _distance in matched_chunks:
                context_parts.append(
                    f"Source Document: {chunk.item.title} (Type: {chunk.item.content_type})\n"
                    f"Document Summary: {chunk.item.summary or 'No summary available.'}\n"
                    f"Snippet:\n{chunk.content}"
                )
                if chunk.item.id not in seen_items:
                    seen_items.add(chunk.item.id)
                    sources.append({"id": str(chunk.item.id), "title": chunk.item.title, "type": chunk.item.content_type})
            context_text = "\n\n---\n\n".join(context_parts)
            logger.info("RAG matched %d/%d candidate chunks across %d source documents", len(matched_chunks), RAG_CANDIDATE_LIMIT, len(sources))
    except Exception as e:
        logger.error(f"Error during RAG context retrieval: {e}")
        context_text = ""
        sources = []

    history = []
    try:
        async with db.begin_nested():
            hist_sel = await db.execute(
                select(Message)
                .where(Message.conversation_id == conv.id, Message.id != user_msg.id)
                .order_by(Message.created_at.desc())
                .limit(6)
            )
            history = [{"role": m.role, "content": m.content} for m in reversed(hist_sel.scalars().all())]
    except Exception as e:
        logger.warning(f"Failed to fetch conversation history: {e}")
        history = []

    system_prompt = (
        "You are Magnet, a fast, concise AI companion and developer co-pilot.\n\n"
        "RESPONSE RULES:\n"
        "- Be concise and direct unless the user asks for detail.\n"
        "- Never invent personal facts.\n"
        "- Personal Context is background about the user, not evidence for factual claims.\n"
        "- Retrieved Knowledge is evidence. Use only relevant snippets. When relying on a retrieved document, mention its exact source title in the answer. Do not list documents that were not used.\n\n"
        f"Personal Context (always available):\n{personal_context or '[Unavailable]'}\n\n"
        f"Retrieved Knowledge Context (only relevant matches):\n{context_text if context_text else '[No matching knowledge snippets found in Magnet]'}"
    )

    try:
        ai_reply = await get_completion(system_prompt, payload.content, history=history)
    except Exception as e:
        logger.error(f"Error during LLM response generation: {e}")
        ai_reply = f"Error generating response: {str(e)}"

    # Only expose sources the generated answer explicitly references by title.
    # The retrieval candidate list may contain related chunks that were not
    # actually used in the final answer; do not show those as citations.
    if sources and ai_reply:
        reply_lower = ai_reply.casefold()
        referenced_sources = [
            source for source in sources
            if source.get("title") and source["title"].casefold() in reply_lower
        ]
        sources = referenced_sources

    assistant_msg = Message(conversation_id=conv.id, role="assistant", content=ai_reply, sources=sources)
    db.add(assistant_msg)
    conv.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(assistant_msg)
    return assistant_msg


@router.get("/conversations/{id}/messages", response_model=List[MessageOut])
async def get_messages(id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conv_sel = await db.execute(select(Conversation).where(Conversation.id == id))
    if not conv_sel.scalars().first():
        raise HTTPException(status_code=404, detail="Conversation not found")
    result = await db.execute(select(Message).where(Message.conversation_id == id).order_by(Message.created_at.asc()))
    return result.scalars().all()
