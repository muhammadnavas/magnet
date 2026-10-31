-- Magnet Finance Intelligence: transaction records parsed from explicitly permitted Android notifications.
-- Run this migration in the Supabase SQL editor before using the Finance API.
create table if not exists public.finance_transactions (
    id uuid primary key default gen_random_uuid(),
    amount numeric(14,2) not null check (amount > 0),
    currency varchar(3) not null default 'INR',
    merchant varchar(255) not null,
    category varchar(50) not null default 'Other',
    transaction_type varchar(20) not null check (transaction_type in ('expense','income')),
    source_app varchar(120) not null,
    source_package varchar(255) not null,
    occurred_at timestamptz not null,
    fingerprint varchar(64) not null unique,
    note text,
    created_at timestamptz not null default now()
);
create index if not exists ix_finance_transactions_occurred_at on public.finance_transactions(occurred_at desc);
create index if not exists ix_finance_transactions_category on public.finance_transactions(category);
alter table public.finance_transactions enable row level security;
revoke all on table public.finance_transactions from anon, authenticated;
