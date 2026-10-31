-- Backend-driven spending limits and push alert deduplication.
create table if not exists public.finance_limits (
    id uuid primary key default gen_random_uuid(),
    scope_key varchar(60) not null unique,
    category varchar(50),
    amount numeric(14,2) not null check (amount > 0),
    enabled boolean not null default true,
    timezone_offset_minutes integer not null default -330 check (timezone_offset_minutes between -840 and 840),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create table if not exists public.finance_push_devices (
    id uuid primary key default gen_random_uuid(),
    expo_push_token varchar(255) not null unique,
    platform varchar(20) not null default 'android',
    enabled boolean not null default true,
    created_at timestamptz not null default now()
);
create table if not exists public.finance_alert_events (
    id uuid primary key default gen_random_uuid(),
    limit_id uuid not null references public.finance_limits(id) on delete cascade,
    period_key varchar(7) not null,
    threshold_percent integer not null check (threshold_percent in (50,80,100)),
    spent_amount numeric(14,2) not null,
    created_at timestamptz not null default now(),
    constraint uq_finance_alert_period_threshold unique(limit_id, period_key, threshold_percent)
);
create index if not exists ix_finance_limits_enabled on public.finance_limits(enabled);
alter table public.finance_limits enable row level security;
alter table public.finance_push_devices enable row level security;
alter table public.finance_alert_events enable row level security;
revoke all on table public.finance_limits, public.finance_push_devices, public.finance_alert_events from anon, authenticated;
