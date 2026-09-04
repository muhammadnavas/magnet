import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, ForeignKey, JSON, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

# Junction table for KnowledgeItem <-> Project
knowledge_projects = Table(
    "knowledge_projects",
    Base.metadata,
    Column("knowledge_id", UUID(as_uuid=True), ForeignKey("knowledge_items.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
)

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    technologies: Mapped[list] = mapped_column(JSON, default=list, nullable=True) # list of string technologies
    github_url: Mapped[str] = mapped_column(String(2048), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active") # active, archived, completed
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relationships
    knowledge_items = relationship("KnowledgeItem", secondary=knowledge_projects, back_populates="projects")
