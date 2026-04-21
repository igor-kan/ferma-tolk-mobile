-- =============================================================================
-- Migration: 009_data_archival_purging
-- Project:   Ferma.Tolk
-- Ticket:    FT-029
-- Created:   2026-04-06
-- Depends on: 001_initial_schema
-- =============================================================================
-- Sets up infrastructure for automated data archival and purging.
-- =============================================================================

-- 1. Archive table for old transactions
CREATE TABLE IF NOT EXISTS public.transactions_archive (
    LIKE public.transactions INCLUDING ALL
);

COMMENT ON TABLE public.transactions_archive IS
    'Cold storage for transactions older than the 3-year retention window.';

-- 2. Purge soft-deleted transactions older than 30 days
-- Note: In a production Supabase environment, this would be called by 
-- pg_cron or a Edge Function scheduled task.
CREATE OR REPLACE FUNCTION public.purge_deleted_transactions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.transactions
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Archive old transactions function
CREATE OR REPLACE FUNCTION public.archive_old_transactions()
RETURNS void AS $$
BEGIN
    WITH archived AS (
        DELETE FROM public.transactions
        WHERE entry_date < now() - INTERVAL '3 years'
        RETURNING *
    )
    INSERT INTO public.transactions_archive
    SELECT * FROM archived;
END;
$$ LANGUAGE plpgsql;
