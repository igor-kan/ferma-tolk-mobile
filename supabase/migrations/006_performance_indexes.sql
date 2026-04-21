-- =============================================================================
-- Migration: 006_performance_indexes
-- Project:   Ferma.Tolk
-- Ticket:    FT-024
-- Created:   2026-04-06
-- Depends on: 005_taxonomy_keywords
-- =============================================================================
-- Adds database indexes for dominant access patterns based on application usage.
-- =============================================================================

-- 1. Transactions: farm/org membership + entry dates
-- Speeds up pagination and lists for farm-scoped queries.
CREATE INDEX IF NOT EXISTS idx_transactions_farm_date 
    ON public.transactions (farm_id, entry_date DESC) 
    WHERE deleted_at IS NULL;

-- 2. Transactions: category/date filters (Analytics)
-- Speeds up analytics filtering by OPEX/CAPEX alongside the period (month/year).
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date 
    ON public.transactions (user_id, category, entry_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_farm_category_date 
    ON public.transactions (farm_id, category, entry_date DESC)
    WHERE deleted_at IS NULL;

-- 3. Projects: created dates sorting
-- The application queries projects by user_id and orders by created_at.
CREATE INDEX IF NOT EXISTS idx_projects_user_created 
    ON public.projects (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_projects_farm_created 
    ON public.projects (farm_id, created_at);

-- 4. Farm memberships: RLS speedup
-- RLS policies frequently check if a user is an active owner/admin/member.
CREATE INDEX IF NOT EXISTS idx_farm_memberships_user_status_role
    ON public.farm_memberships (user_id, status, role);

-- 5. Transactions: type + category (Analytics Predicates)
-- Supports quick aggregation rollups over 'expense' / 'opex'.
CREATE INDEX IF NOT EXISTS idx_transactions_type_category
    ON public.transactions (type, category)
    WHERE deleted_at IS NULL;
