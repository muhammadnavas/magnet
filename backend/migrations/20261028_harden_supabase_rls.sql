-- Supabase Security Advisor hardening for Magnet/Orio.
-- Apply this migration to the project's Supabase Postgres database.
--
-- The mobile app talks to the FastAPI backend; it does not use Supabase's
-- anon/authenticated Data API directly. Keep database access server-side via
-- the backend's DATABASE_URL. Do not put a service-role key in the mobile app.
--
-- RLS is enabled without client policies intentionally: the app's custom JWT
-- users are not Supabase Auth users, so auth.uid() policies would not correctly
-- isolate rows. This makes direct anon/authenticated PostgREST access deny by
-- default while the trusted backend DB owner continues to work.

BEGIN;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            t.schemaname,
            t.tablename
        );

        -- Prevent direct access through Supabase's public API roles.
        EXECUTE format(
            'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon, authenticated',
            t.schemaname,
            t.tablename
        );
    END LOOP;
END
$$;

-- Prevent public API roles from using existing or newly created sequences.
DO $$
DECLARE
    s RECORD;
BEGIN
    FOR s IN
        SELECT sequence_schema, sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format(
            'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM anon, authenticated',
            s.sequence_schema,
            s.sequence_name
        );
    END LOOP;
END
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Apply the same safe defaults to objects created later by the migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
