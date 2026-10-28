-- Magnet/Orio security hardening for the Supabase public schema.
-- The application accesses PostgreSQL through the authenticated FastAPI backend.
-- Do not add broad anon/authenticated policies: the backend remains responsible
-- for user authentication and authorization.
--
-- Run this once in Supabase SQL Editor as a project owner. Review the results
-- in Security Advisor afterward.

begin;

do $$
declare
    item record;
begin
    -- RLS blocks PostgREST/API roles unless a deliberate policy grants access.
    -- Iterate over all current public tables so newly discovered sensitive
    -- tables are covered as well as the known application tables.
    for item in
        select schemaname, tablename
        from pg_tables
        where schemaname = 'public'
    loop
        execute format('alter table %I.%I enable row level security',
                       item.schemaname, item.tablename);
        execute format('revoke all privileges on table %I.%I from anon, authenticated',
                       item.schemaname, item.tablename);
    end loop;
end
$$;

-- Also remove direct API access to public-schema sequences and functions.
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

-- Keep future objects closed to API roles by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

commit;
