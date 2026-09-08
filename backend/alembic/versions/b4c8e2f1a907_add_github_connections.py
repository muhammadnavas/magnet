"""add github connections

Revision ID: b4c8e2f1a907
Revises: 9a1f0d2c7b31
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b4c8e2f1a907"
down_revision: Union[str, None] = "9a1f0d2c7b31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # github_connections existed in the original schema. The 2026-09-04
    # migration removed its user_id column but intentionally kept the table.
    # The GitHub OAuth implementation uses a different schema, so replace the
    # empty legacy table instead of attempting to create a duplicate table.
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("github_connections"):
        row_count = bind.execute(sa.text("SELECT COUNT(*) FROM github_connections")).scalar_one()
        if row_count:
            raise RuntimeError(
                "Legacy github_connections contains data. Stop the migration and migrate "
                "those rows before applying b4c8e2f1a907."
            )
        op.drop_table("github_connections")

    op.create_table(
        "github_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("github_user_id", sa.Integer(), nullable=False),
        sa.Column("github_username", sa.String(length=255), nullable=False),
        sa.Column("access_token", sa.String(length=4096), nullable=False),
        sa.Column("scope", sa.String(length=1024), nullable=True),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_github_connections_user_id",
        "github_connections",
        ["user_id"],
        unique=True,
    )
    op.create_unique_constraint(
        "uq_github_connections_github_user_id",
        "github_connections",
        ["github_user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_github_connections_github_user_id",
        "github_connections",
        type_="unique",
    )
    op.drop_index("ix_github_connections_user_id", table_name="github_connections")
    op.drop_table("github_connections")
