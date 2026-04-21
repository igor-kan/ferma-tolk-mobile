-- =============================================================================
-- Migration: 010_fix_farm_memberships_rls_recursion
-- Project:   Ferma.Tolk
-- Ticket:    FT-034
-- Created:   2026-04-19
-- Depends on: 002_farms_memberships_preferences, 004_rls_hardening
-- =============================================================================
-- Fixes "42P17: infinite recursion detected in policy for relation
-- farm_memberships" by replacing self-referencing farm_memberships policies
-- with SECURITY DEFINER helper functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Internal RLS helper functions
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_farm_admin(_farm_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.farm_memberships fm
        WHERE fm.farm_id = _farm_id
          AND fm.user_id = _user_id
          AND fm.role IN ('owner', 'admin')
          AND fm.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION private.is_farm_owner(_farm_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.farm_memberships fm
        WHERE fm.farm_id = _farm_id
          AND fm.user_id = _user_id
          AND fm.role = 'owner'
          AND fm.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION private.is_farm_admin(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_farm_owner(UUID, UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_farm_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_farm_owner(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Recreate only the recursive farm_memberships policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "memberships: admins see farm" ON public.farm_memberships;
CREATE POLICY "memberships: admins see farm"
    ON public.farm_memberships FOR SELECT
    TO authenticated
    USING ((SELECT private.is_farm_admin(farm_id, auth.uid())));

DROP POLICY IF EXISTS "memberships: admins can invite" ON public.farm_memberships;
CREATE POLICY "memberships: admins can invite"
    ON public.farm_memberships FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT private.is_farm_admin(farm_id, auth.uid())));

DROP POLICY IF EXISTS "memberships: admins can manage" ON public.farm_memberships;
CREATE POLICY "memberships: admins can manage"
    ON public.farm_memberships FOR UPDATE
    TO authenticated
    USING ((SELECT private.is_farm_admin(farm_id, auth.uid())))
    WITH CHECK ((SELECT private.is_farm_admin(farm_id, auth.uid())));

DROP POLICY IF EXISTS "memberships: owners can remove or self-leave" ON public.farm_memberships;
CREATE POLICY "memberships: owners can remove or self-leave"
    ON public.farm_memberships FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR (SELECT private.is_farm_owner(farm_id, auth.uid()))
    );
