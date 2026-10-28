"""Enable RLS and block direct Supabase Data API access.

The application accesses Postgres through its authenticated FastAPI backend and
does not use Supabase's anon/authenticated roles for data access. Enable RLS on
every existing public table and revoke direct API-role privileges so private
rows (including credentials and personal context) cannot be read or changed via
the project URL. The backend's database owner/service connection continues to
operate as before; do not FORCE ROW LEVEL SECURITY because the backend uses
server-side authorization.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "7d3a9b1c4e20"
down_revision: Union[str, None] = "c1d9e3f2b018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    # Discover tables rather than hard-coding a partial list: the project has
    # evolved through several migrations and includes sensitive legacy tables.
    tables = bind.execute(sa.text("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    """)).scalars().all()

    for table in tables:
        # Identifiers come from pg_tables; quote them safely via PostgreSQL
        # format(%I) in a DO block to avoid identifier-injection issues.
        bind.execute(sa.text("""
            SELECT format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', :table_name)
        """), {"table_name": table})
        quoted = '"' + table.replace('"', '""') + '"'
        op.execute(f"ALTER TABLE public.{quoted} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL PRIVILEGES ON TABLE public.{quoted} FROM anon, authenticated")

    # Ensure future tables created by the migration owner do not automatically
    # become accessible to the public Supabase API roles.
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated")
    op.execute("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated")


def downgrade() -> None:
    # Intentionally do not disable RLS or restore public API privileges during
    # downgrade: doing so would reopen the exposure this migration closes.
    pass
