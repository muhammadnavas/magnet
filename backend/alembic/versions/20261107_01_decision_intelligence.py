"""Add Decision Intelligence timeline tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261107_01"
down_revision = "20261101_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("alternatives", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("uncertainties", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(24), nullable=False, server_default="exploring"),
        sa.Column("selected_alternative", sa.String(240), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "decision_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("decision_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alternative", sa.String(240), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", sa.String(32), nullable=False, server_default="milestone"),
        sa.Column("offset_days", sa.Integer(), nullable=False),
        sa.Column("is_user_defined", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("follow_up_options", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_decision_events_decision_id", "decision_events", ["decision_id"])


def downgrade() -> None:
    op.drop_index("ix_decision_events_decision_id", table_name="decision_events")
    op.drop_table("decision_events")
    op.drop_table("decisions")
