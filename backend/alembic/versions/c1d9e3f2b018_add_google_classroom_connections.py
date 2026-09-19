"""add google classroom connections

Revision ID: c1d9e3f2b018
Revises: b4c8e2f1a907
Create Date: 2026-09-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c1d9e3f2b018"
down_revision: Union[str, None] = "b4c8e2f1a907"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "google_classroom_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("google_user_id", sa.String(length=255), nullable=False),
        sa.Column("google_email", sa.String(length=512), nullable=False),
        sa.Column("access_token", sa.String(length=4096), nullable=False),
        sa.Column("refresh_token", sa.String(length=4096), nullable=True),
        sa.Column("token_expiry", sa.DateTime(), nullable=True),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_google_classroom_connections_user_id",
        "google_classroom_connections",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_google_classroom_connections_user_id",
        table_name="google_classroom_connections",
    )
    op.drop_table("google_classroom_connections")
