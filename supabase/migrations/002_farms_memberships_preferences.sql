-- =============================================================================
-- Migration: 002_farms_memberships_preferences
-- Project:   Ferma.Tolk
-- Ticket:    FT-005
-- Created:   2026-04-05
-- Depends on: 001_initial_schema
-- =============================================================================
-- Introduces the multi-tenant ownership layer:
--
--   users  ──< farm_memberships >──  farms
--                    │
--                    └─ role (owner | admin | member | viewer)
--
-- Every entity that previously hung directly off user_id is generalised to
-- optionally hang off a farm_id instead.  A "personal farm" is auto-created
-- for every user so the existing 1-user model continues to work unchanged.
--
-- Also adds:
--   user_preferences  — dashboard UI state, language, currency
--   farms             — the organisation/farm entity
--   farm_memberships  — junction with role + invite flow
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. farms
-- ---------------------------------------------------------------------------
-- An organisation-level entity.  A solo user has exactly one farm (personal).
-- Teams can share one farm and all its projects / transactions.
-- ---------------------------------------------------------------------------
CREATE TABLE public.farms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE,               -- URL-safe identifier, optional
    description     TEXT,
    country_code    TEXT DEFAULT 'KZ',         -- ISO 3166-1 alpha-2
    currency_code   TEXT DEFAULT 'KZT',        -- ISO 4217
    timezone        TEXT DEFAULT 'Asia/Almaty',
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.farms IS
    'Organisation / farm entity. One or more users can be members of a farm. '
    'Every user gets a personal farm auto-created on registration.';

CREATE TRIGGER farms_updated_at
    BEFORE UPDATE ON public.farms
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: members can read; only owners/admins can update/delete
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. farm_memberships
-- ---------------------------------------------------------------------------
-- Junction table between users and farms.
-- role:   owner  — full control, cannot be removed by others
--         admin  — can manage members and all data
--         member — can read/write data
--         viewer — read-only
-- status: active | invited | suspended
-- ---------------------------------------------------------------------------
CREATE TYPE public.farm_role   AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended');

CREATE TABLE public.farm_memberships (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role        public.farm_role NOT NULL DEFAULT 'member',
    status      public.member_status NOT NULL DEFAULT 'invited',
    invited_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farm_id, user_id)
);

COMMENT ON TABLE public.farm_memberships IS
    'Many-to-many junction: one user may belong to multiple farms with different roles.';

CREATE INDEX idx_farm_memberships_user  ON public.farm_memberships (user_id);
CREATE INDEX idx_farm_memberships_farm  ON public.farm_memberships (farm_id);

CREATE TRIGGER farm_memberships_updated_at
    BEFORE UPDATE ON public.farm_memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "farms: members can read"
    ON public.farms FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = farms.id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

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
    );

CREATE POLICY "farms: owners can delete"
    ON public.farms FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = farms.id
              AND fm.user_id = auth.uid()
              AND fm.role = 'owner'
              AND fm.status = 'active'
        )
    );

-- Authenticated users can insert new farms (they become owner via trigger)
CREATE POLICY "farms: authenticated users can create"
    ON public.farms FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.farm_memberships ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "memberships: users see own"
    ON public.farm_memberships FOR SELECT
    USING (user_id = auth.uid());

-- Farm owners/admins can see all memberships for their farms
CREATE POLICY "memberships: admins see farm"
    ON public.farm_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_memberships me
            WHERE me.farm_id = farm_memberships.farm_id
              AND me.user_id = auth.uid()
              AND me.role IN ('owner', 'admin')
              AND me.status = 'active'
        )
    );

-- Owners/admins can insert memberships (invite flow)
CREATE POLICY "memberships: admins can invite"
    ON public.farm_memberships FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.farm_memberships me
            WHERE me.farm_id = farm_memberships.farm_id
              AND me.user_id = auth.uid()
              AND me.role IN ('owner', 'admin')
              AND me.status = 'active'
        )
    );

-- Users can update their own membership (accept invite)
CREATE POLICY "memberships: accept own invite"
    ON public.farm_memberships FOR UPDATE
    USING (user_id = auth.uid());

-- Owners/admins can update any membership in their farm (change role, suspend)
CREATE POLICY "memberships: admins can manage"
    ON public.farm_memberships FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.farm_memberships me
            WHERE me.farm_id = farm_memberships.farm_id
              AND me.user_id = auth.uid()
              AND me.role IN ('owner', 'admin')
              AND me.status = 'active'
        )
    );

-- Only owners can remove memberships; users can remove themselves
CREATE POLICY "memberships: owners can remove or self-leave"
    ON public.farm_memberships FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.farm_memberships me
            WHERE me.farm_id = farm_memberships.farm_id
              AND me.user_id = auth.uid()
              AND me.role = 'owner'
              AND me.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- 3. Auto-create personal farm + owner membership on user registration
-- ---------------------------------------------------------------------------
-- Extends the handle_new_user trigger from migration 001 by also creating
-- a personal farm and an active owner membership for every new user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_farm_id UUID;
BEGIN
    -- Insert public profile (from 001, kept intact)
    INSERT INTO public.users (id, email, security_hint)
    VALUES (
        NEW.id,
        NEW.email,
        (NEW.raw_user_meta_data->>'security_hint')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create a personal farm for the new user
    INSERT INTO public.farms (name, slug, currency_code, timezone)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'farm_name', split_part(NEW.email, '@', 1) || '''s Farm'),
        NULL,   -- slug left null; can be set later
        COALESCE(NEW.raw_user_meta_data->>'currency_code', 'KZT'),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Asia/Almaty')
    )
    RETURNING id INTO v_farm_id;

    -- Make the new user the owner of their personal farm
    INSERT INTO public.farm_memberships (farm_id, user_id, role, status, accepted_at)
    VALUES (v_farm_id, NEW.id, 'owner', 'active', now());

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Add farm_id to data tables
-- ---------------------------------------------------------------------------
-- projects, transactions, description_mappings, forecast_adjustments,
-- and chat_messages all gain an optional farm_id column.
--
-- When farm_id IS NULL the row is treated as belonging to the user's personal
-- farm (backward-compatible with data written before this migration).
-- The application will always supply farm_id going forward.
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects
    ADD COLUMN farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

CREATE INDEX idx_projects_farm ON public.projects (farm_id);

-- Update projects RLS: farm members with write access can manage projects
DROP POLICY IF EXISTS "projects: full access to own rows" ON public.projects;

CREATE POLICY "projects: personal (no farm_id)"
    ON public.projects FOR ALL
    USING (
        farm_id IS NULL AND auth.uid() = user_id
    )
    WITH CHECK (
        farm_id IS NULL AND auth.uid() = user_id
    );

CREATE POLICY "projects: farm members can read"
    ON public.projects FOR SELECT
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = projects.farm_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

CREATE POLICY "projects: farm members/admins can write"
    ON public.projects FOR INSERT
    WITH CHECK (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = projects.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

CREATE POLICY "projects: farm members/admins can update"
    ON public.projects FOR UPDATE
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = projects.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

CREATE POLICY "projects: farm admins/owners can delete"
    ON public.projects FOR DELETE
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = projects.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- transactions: add farm_id, update RLS
ALTER TABLE public.transactions
    ADD COLUMN farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

CREATE INDEX idx_transactions_farm ON public.transactions (farm_id) WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "transactions: full access to own rows" ON public.transactions;

CREATE POLICY "transactions: personal"
    ON public.transactions FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

CREATE POLICY "transactions: farm read"
    ON public.transactions FOR SELECT
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transactions.farm_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

CREATE POLICY "transactions: farm write"
    ON public.transactions FOR INSERT
    WITH CHECK (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transactions.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

CREATE POLICY "transactions: farm update"
    ON public.transactions FOR UPDATE
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transactions.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

CREATE POLICY "transactions: farm admin delete"
    ON public.transactions FOR DELETE
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transactions.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- description_mappings: add farm_id
ALTER TABLE public.description_mappings
    ADD COLUMN farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "description_mappings: full access to own rows" ON public.description_mappings;

CREATE POLICY "description_mappings: personal"
    ON public.description_mappings FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

CREATE POLICY "description_mappings: farm access"
    ON public.description_mappings FOR ALL
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = description_mappings.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = description_mappings.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

-- forecast_adjustments: add farm_id
ALTER TABLE public.forecast_adjustments
    ADD COLUMN farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "forecast_adjustments: full access to own rows" ON public.forecast_adjustments;

CREATE POLICY "forecast_adjustments: personal"
    ON public.forecast_adjustments FOR ALL
    USING  (farm_id IS NULL AND auth.uid() = user_id)
    WITH CHECK (farm_id IS NULL AND auth.uid() = user_id);

CREATE POLICY "forecast_adjustments: farm access"
    ON public.forecast_adjustments FOR ALL
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = forecast_adjustments.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = forecast_adjustments.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin', 'member')
              AND fm.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- 5. user_preferences
-- ---------------------------------------------------------------------------
-- Per-user UI state and configuration.  One row per user.
-- Replaces agri_selected_month_{uid} and agri_selected_year_{uid} localStorage
-- keys; also stores language preference.
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_preferences (
    user_id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    language            TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'en')),
    selected_month      SMALLINT CHECK (selected_month >= 0 AND selected_month <= 11),
    selected_year       SMALLINT CHECK (selected_year >= 2020 AND selected_year <= 2100),
    default_farm_id     UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS
    'Per-user UI and application preferences. '
    'Replaces agri_selected_month/year localStorage keys.';

CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences: full access to own row"
    ON public.user_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Auto-create preferences row on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_farm_id UUID;
BEGIN
    -- Public profile
    INSERT INTO public.users (id, email, security_hint)
    VALUES (
        NEW.id,
        NEW.email,
        (NEW.raw_user_meta_data->>'security_hint')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Personal farm
    INSERT INTO public.farms (name, currency_code, timezone)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'farm_name', split_part(NEW.email, '@', 1) || '''s Farm'),
        COALESCE(NEW.raw_user_meta_data->>'currency_code', 'KZT'),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Asia/Almaty')
    )
    RETURNING id INTO v_farm_id;

    -- Owner membership
    INSERT INTO public.farm_memberships (farm_id, user_id, role, status, accepted_at)
    VALUES (v_farm_id, NEW.id, 'owner', 'active', now());

    -- Default preferences
    INSERT INTO public.user_preferences (user_id, default_farm_id)
    VALUES (NEW.id, v_farm_id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT ALL ON public.farms              TO authenticated;
GRANT ALL ON public.farm_memberships   TO authenticated;
GRANT ALL ON public.user_preferences   TO authenticated;
GRANT USAGE ON TYPE public.farm_role     TO authenticated;
GRANT USAGE ON TYPE public.member_status TO authenticated;
