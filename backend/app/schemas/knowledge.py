from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class TagBase(BaseModel):
    name: str
    color: str = "#6C63FF"

class TagCreate(TagBase):
    pass

class TagOut(TagBase):
    id: uuid.UUID
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = []
    github_url: Optional[str] = None
    status: str = "active"

class ProjectCreate(ProjectBase):
    pass

class ProjectOut(ProjectBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class KnowledgeItemBase(BaseModel):
    title: str
    content_type: str
    raw_content: Optional[str] = None
    source_url: Optional[str] = None

class KnowledgeItemCreate(KnowledgeItemBase):
    project: Optional[str] = None
    tags: Optional[List[str]] = None

class KnowledgeItemOut(KnowledgeItemBase):
    id: uuid.UUID
    user_id: uuid.UUID
    extracted_text: Optional[str] = None
    summary: Optional[str] = None
    key_points: List[str] = []
    meta: Dict[str, Any] = {}
    processing_status: str
    is_favorite: bool
    is_archived: bool
    file_path: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tags: List[TagOut] = []
    projects: List[ProjectOut] = []

    class Config:
        from_attributes = True

class KnowledgeChunkOut(BaseModel):
    id: uuid.UUID
    knowledge_id: uuid.UUID
    chunk_index: int
    content: str
    token_count: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
