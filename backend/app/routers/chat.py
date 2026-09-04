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

@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Conversation)
        .where(True)
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/chat", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def ask_chat(
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Resolve or create conversation
    conv = None
    if payload.conversation_id:
        conv_sel = await db.execute(
            select(Conversation).where(
                Conversation.id == payload.conversation_id
            )
        )
        conv = conv_sel.scalars().first()
        
    if not conv:
        # Create a new conversation with a default title based on message snippet
        words = payload.content.split()
        title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        conv = Conversation( title=title)
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

    # 3. RAG: Retrieve context chunks using pgvector similarity query
    context_text = ""
    sources = []
    try:
        # Generate query embedding
        query_embedding = await get_embedding(payload.content)
        
        # Query most similar chunks using cosine similarity distance
        chunks_sel = await db.execute(
            select(KnowledgeChunk)
            .join(KnowledgeChunk.item)
            .where(
                
                KnowledgeItem.is_archived == False,
                KnowledgeItem.processing_status == "completed"
            )
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding))
            .limit(4)
            .options(selectinload(KnowledgeChunk.item))
        )
        chunks = chunks_sel.scalars().all()
        
        # Format context and sources list
        context_parts = []
        seen_items = set()
        for chunk in chunks:
            context_parts.append(
                f"Source Document: {chunk.item.title} (Type: {chunk.item.content_type})\n"
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
    except Exception as e:
        logger.error(f"Error during RAG context retrieval: {e}")
        # Continue with empty context

    # 4. Formulate LLM prompts and generate response
    system_prompt = (
        "You are Orio, a helpful technical AI assistant specialized in developer documentation. "
        "The user has an indexed personal knowledge base. Below is some retrieved context relevant to the user query.\n"
        "Please answer the user query as accurately as possible based on the retrieved context. Format code blocks using "
        "proper markdown syntax. If the retrieved context is insufficient or irrelevant, provide your best general technical answer "
        "but clearly mention that you did not find specific records in their Orio database.\n\n"
        f"Retrieved Context:\n{context_text if context_text else '[No matching knowledge snippets found in Orio]'}"
    )

    try:
        ai_reply = await get_completion(system_prompt, payload.content)
    except Exception as e:
        logger.error(f"Error during LLM response generation: {e}")
        ai_reply = f"Error generating response: {str(e)}"

    # 5. Store AI response message
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=ai_reply,
        sources=sources
    )
    db.add(assistant_msg)
    
    # Update conversation timestamps
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
    # Verify ownership of conversation
    conv_sel = await db.execute(
        select(Conversation).where(Conversation.id == id)
    )
    conv = conv_sel.scalars().first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or access denied"
        )
        
    query = (
        select(Message)
        .where(Message.conversation_id == id)
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()
