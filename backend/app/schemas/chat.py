from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class MessageBase(BaseModel):
    role: str
    content: str
    sources: List[Dict[str, Any]] = []

class MessageCreate(BaseModel):
    content: str
    conversation_id: Optional[uuid.UUID] = None

class MessageOut(MessageBase):
    id: uuid.UUID
    conversation_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: str = "New Conversation"

class ConversationCreate(ConversationBase):
    pass

class ConversationOut(ConversationBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
