"""Create Magnet Finance transaction and spending alert tables.

This revision is intentionally idempotent because the same schema may already
have been applied manually through the Supabase SQL editor.
"""
from alembic import op

revision = "20261101_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.finance_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        amount numeric(14,2) NOT NULL CHECK (amount > 0),
        currency varchar(3) NOT NULL DEFAULT 'INR',
        merchant varchar(255) NOT NULL,
        category varchar(50) NOT NULL DEFAULT 'Other',
        transaction_type varchar(20) NOT NULL CHECK (transaction_type IN ('expense','income')),
        source_app varchar(120) NOT NULL,
        source_package varchar(255) NOT NULL,
        occurred_at timestamptz NOT NULL,
        fingerprint varchar(64) NOT NULL UNIQUE,
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.finance_limits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scope_key varchar(60) NOT NULL UNIQUE,
        category varchar(50),
        amount numeric(14,2) NOT NULL CHECK (amount > 0),
        enabled boolean NOT NULL DEFAULT true,
        timezone_offset_minutes integer NOT NULL DEFAULT -330
            CHECK (timezone_offset_minutes BETWEEN -840 AND 840),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.finance_push_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        expo_push_token varchar(255) NOT NULL UNIQUE,
        platform varchar(20) NOT NULL DEFAULT 'android',
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.finance_alert_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        limit_id uuid NOT NULL REFERENCES public.finance_limits(id) ON DELETE CASCADE,
        period_key varchar(7) NOT NULL,
        threshold_percent integer NOT NULL CHECK (threshold_percent IN (50,80,100)),
        spent_amount numeric(14,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_finance_alert_period_threshold
            UNIQUE(limit_id, period_key, threshold_percent)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_finance_transactions_occurred_at ON public.finance_transactions (occurred_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_finance_transactions_category ON public.finance_transactions (category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_finance_limits_enabled ON public.finance_limits (enabled)")
    op.execute("ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.finance_limits ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.finance_push_devices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.finance_alert_events ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.finance_transactions, public.finance_limits, public.finance_push_devices, public.finance_alert_events FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.finance_alert_events")
    op.execute("DROP TABLE IF EXISTS public.finance_push_devices")
    op.execute("DROP TABLE IF EXISTS public.finance_limits")
    op.execute("DROP TABLE IF EXISTS public.finance_transactions")
