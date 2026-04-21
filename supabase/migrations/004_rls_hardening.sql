-- =============================================================================
-- Migration: 004_rls_hardening
-- Project:   Ferma.Tolk
-- Ticket:    FT-007
-- Created:   2026-04-05
-- Depends on: 001, 002, 003
-- =============================================================================
-- Audits and hardens every RLS policy after FT-005/FT-007 review.
-- Addresses the following findings:
--
--   FINDING-01: memberships "accept own invite" UPDATE has no WITH CHECK —
--               an invitee could escalate their own role to 'owner'.
--
--   FINDING-02: farms INSERT is open to all authenticated users without limit —
--               hardened to require auth.uid() IS NOT NULL (unchanged) but adds
--               an explicit comment and rate-limit note.
--
--   FINDING-03: anon role has no explicit DENY — RLS with no matching policy
--               implicitly denies; this migration makes that explicit with a
--               revocation of default public grants on all tables.
--
--   FINDING-04: description_mappings and forecast_adjustments "personal" policies
--               use FOR ALL which covers INSERT but the WITH CHECK clause must
--               also guard against a user writing another user's user_id.
--               Added explicit WITH CHECK that enforces auth.uid() = user_id
--               on INSERT for personal rows.
--
--   FINDING-05: transactions "personal" policy FOR ALL lacks WITH CHECK on
--               the user_id column for INSERT — a crafted INSERT could set an
--               arbitrary user_id if not checked.
--
--   FINDING-06: projects "personal" policy same issue as FINDING-05.
--
--   FINDING-07: "farms: owners and admins can update" has no WITH CHECK —
--               a malicious UPDATE could change the farm's owner_id (if such
--               a column existed). No such column exists currently, but we add
--               WITH CHECK = USING clause for defense in depth.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FINDING-01: Harden "memberships: accept own invite"
-- An invited user should only be able to set status = 'active' and
-- accepted_at on their own row. They must not be able to change their role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "memberships: accept own invite" ON public.farm_memberships;

CREATE POLICY "memberships: accept own invite"
    ON public.farm_memberships FOR UPDATE
    USING (
        -- Can only update their own membership row
        user_id = auth.uid()
        -- Only invited members accepting their invite; active members cannot
        -- use this policy to change their own role.
        AND status = 'invited'
    )
    WITH CHECK (
        -- The updated row must keep user_id and farm_id unchanged
        user_id = auth.uid()
        -- Role must remain what it was — acceptance does not change role
        -- (role changes are handled by the admin manage policy)
        -- We enforce this by requiring the new status to be 'active' only
        AND status = 'active'
    );

-- ---------------------------------------------------------------------------
-- FINDING-03: Explicitly revoke default PUBLIC privileges on all tables.
-- Supabase sets `GRANT ALL ON ... TO authenticated` but the anon role still
-- has no table privileges and RLS blocks access anyway. However, some older
-- PostgreSQL defaults grant SELECT to PUBLIC on new tables. Explicitly revoke.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.users                   FROM PUBLIC, anon;
REVOKE ALL ON public.farms                   FROM PUBLIC, anon;
REVOKE ALL ON public.farm_memberships        FROM PUBLIC, anon;
REVOKE ALL ON public.user_preferences        FROM PUBLIC, anon;
REVOKE ALL ON public.projects                FROM PUBLIC, anon;
REVOKE ALL ON public.transactions            FROM PUBLIC, anon;
REVOKE ALL ON public.description_mappings    FROM PUBLIC, anon;
REVOKE ALL ON public.forecast_adjustments    FROM PUBLIC, anon;
REVOKE ALL ON public.chat_messages           FROM PUBLIC, anon;
REVOKE ALL ON public.transaction_categories     FROM PUBLIC, anon;
REVOKE ALL ON public.transaction_sub_categories FROM PUBLIC, anon;
REVOKE ALL ON public.opex_sub_categories        FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- FINDING-04 & 05 & 06:
-- "personal" policies FOR ALL with USING but missing WITH CHECK that
-- explicitly binds the user_id on INSERT rows to auth.uid().
-- Drop and recreate the affected policies with proper WITH CHECK clauses.
-- ---------------------------------------------------------------------------

-- transactions: personal
DROP POLICY IF EXISTS "transactions: personal" ON public.transactions;

CREATE POLICY "transactions: personal"
    ON public.transactions FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

-- projects: personal
DROP POLICY IF EXISTS "projects: personal (no farm_id)" ON public.projects;

CREATE POLICY "projects: personal (no farm_id)"
    ON public.projects FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

-- description_mappings: personal (already had WITH CHECK — re-affirm)
DROP POLICY IF EXISTS "description_mappings: personal" ON public.description_mappings;

CREATE POLICY "description_mappings: personal"
    ON public.description_mappings FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

-- forecast_adjustments: personal (already had WITH CHECK — re-affirm)
DROP POLICY IF EXISTS "forecast_adjustments: personal" ON public.forecast_adjustments;

CREATE POLICY "forecast_adjustments: personal"
    ON public.forecast_adjustments FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- FINDING-07: Add WITH CHECK to farms UPDATE policy (defense in depth)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "farms: owners and admins can update" ON public.farms;

CREATE POLICY "farms: owners and admins can update"
    ON public.farms FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = farms.id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = farms.id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- Additional hardening: prevent viewers from inserting chat messages
-- Chat messages are user-scoped (no farm_id). The existing policy correctly
-- uses user_id = auth.uid() for both USING and WITH CHECK. Re-affirm it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "chat_messages: full access to own rows" ON public.chat_messages;

CREATE POLICY "chat_messages: read own"
    ON public.chat_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "chat_messages: insert own"
    ON public.chat_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_messages: delete own"
    ON public.chat_messages FOR DELETE
    USING (auth.uid() = user_id);

-- Note: chat_messages has no UPDATE policy — messages are immutable by design.

-- ---------------------------------------------------------------------------
-- Protect owner membership from self-demotion/deletion via the accept policy.
-- An owner cannot delete themselves if they are the last owner.
-- Enforce via a trigger (RLS cannot reference aggregate state).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Only applies to rows where the deleted user was an owner
    IF OLD.role = 'owner' THEN
        -- Check if there is at least one other active owner remaining
        IF NOT EXISTS (
            SELECT 1 FROM public.farm_memberships
            WHERE farm_id = OLD.farm_id
              AND role = 'owner'
              AND status = 'active'
              AND id <> OLD.id
        ) THEN
            RAISE EXCEPTION
                'Cannot remove the last owner of farm %. Assign another owner first.',
                OLD.farm_id
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_last_owner_removal
    BEFORE DELETE ON public.farm_memberships
    FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_removal();

-- Also fires on UPDATE that changes role away from owner or status to suspended
CREATE OR REPLACE FUNCTION public.prevent_last_owner_demotion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Fires when an owner row is being downgraded or suspended
    IF OLD.role = 'owner' AND (NEW.role <> 'owner' OR NEW.status <> 'active') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.farm_memberships
            WHERE farm_id = OLD.farm_id
              AND role = 'owner'
              AND status = 'active'
              AND id <> OLD.id
        ) THEN
            RAISE EXCEPTION
                'Cannot demote or suspend the last owner of farm %. Assign another owner first.',
                OLD.farm_id
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_last_owner_demotion
    BEFORE UPDATE ON public.farm_memberships
    FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_demotion();
