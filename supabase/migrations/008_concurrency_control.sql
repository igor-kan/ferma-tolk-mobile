-- =============================================================================
-- Migration: 008_concurrency_control
-- Project:   Ferma.Tolk
-- Ticket:    FT-028
-- Created:   2026-04-06
-- Depends on: 001_initial_schema, 002_farms_memberships_preferences
-- =============================================================================
-- Adds versioning and idempotency support for multi-device consistency.
-- =============================================================================

-- 1. Add version column for Optimistic Concurrency Control (OCC)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.projects     ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. Add last_modified_by for audit trail
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);
ALTER TABLE public.projects     ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- 3. Update the set_updated_at function to also increment version if it wasn't manually incremented
-- Actually, it's better to handle version increment in the application logic or a separate trigger.
-- Let's use a trigger to ensure version always bumps on any update.

CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to transactions
DROP TRIGGER IF EXISTS tr_transactions_bump_version ON public.transactions;
CREATE TRIGGER tr_transactions_bump_version
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.bump_version();

-- Apply to projects
DROP TRIGGER IF EXISTS tr_projects_bump_version ON public.projects;
CREATE TRIGGER tr_projects_bump_version
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.bump_version();
