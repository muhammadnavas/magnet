"""add compact personal context

Revision ID: 9a1f0d2c7b31
Revises: 3fcd1522e1bf
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9a1f0d2c7b31"
down_revision: Union[str, None] = "3fcd1522e1bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personal_context",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "personal_context_facts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("value", sa.String(length=255), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_personal_context_facts_category", "personal_context_facts", ["category"])


def downgrade() -> None:
    op.drop_index("ix_personal_context_facts_category", table_name="personal_context_facts")
    op.drop_table("personal_context_facts")
    op.drop_table("personal_context")
