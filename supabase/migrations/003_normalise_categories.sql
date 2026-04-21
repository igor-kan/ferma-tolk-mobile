-- =============================================================================
-- Migration: 003_normalise_categories
-- Project:   Ferma.Tolk
-- Ticket:    FT-005
-- Created:   2026-04-05
-- Depends on: 001_initial_schema, 002_farms_memberships_preferences
-- =============================================================================
-- Currently all OPEX category definitions live as a hard-coded array inside
-- AppContext.jsx (13 entries with id, label, forecastingType, and regex).
-- This migration promotes categories to first-class DB entities so that:
--   - Categories can be extended per farm without a code deploy
--   - forecastingType and regex are stored and queryable
--   - Transactions reference category rows by FK instead of free-text strings
--   - The migration is backward-compatible: existing text values in
--     transactions.category / sub_category are preserved in a text column
--     and will be backfilled to FK references in a later data migration step.
--
-- Entity hierarchy:
--   transaction_categories    (income | expense top-level)
--     └── transaction_sub_categories   (opex, capex, operationalRevenue, ...)
--           └── opex_sub_categories    (fuel, salary, seeds, ...)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. transaction_categories
-- ---------------------------------------------------------------------------
-- Top-level financial classification: income or expense.
-- Seed rows are system-level (farm_id IS NULL) and shared by all farms.
-- Farm-level custom categories are also supported (farm_id IS NOT NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE public.transaction_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,              -- 'income' | 'expense'
    label_ru        TEXT NOT NULL,
    label_en        TEXT NOT NULL,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,   -- system rows cannot be deleted
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farm_id, slug)
);

COMMENT ON TABLE public.transaction_categories IS
    'Top-level transaction classification (income / expense). '
    'System rows are shared; per-farm rows allow custom extensions.';

-- Partial unique index: system slugs (farm_id IS NULL) must be globally unique
CREATE UNIQUE INDEX idx_tx_categories_system_slug
    ON public.transaction_categories (slug)
    WHERE farm_id IS NULL;

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read system categories
CREATE POLICY "tx_categories: public read system"
    ON public.transaction_categories FOR SELECT
    USING (is_system = TRUE OR farm_id IS NULL);

-- Farm members can read farm-specific categories
CREATE POLICY "tx_categories: farm members read"
    ON public.transaction_categories FOR SELECT
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

-- Farm admins/owners can manage farm-specific categories
CREATE POLICY "tx_categories: farm admins manage"
    ON public.transaction_categories FOR ALL
    USING (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- 2. transaction_sub_categories
-- ---------------------------------------------------------------------------
-- Second-level classification under each top-level category.
-- e.g. under 'expense': opex, capex, depreciation
-- e.g. under 'income':  operationalRevenue, subsidies, assetSale
-- ---------------------------------------------------------------------------
CREATE TABLE public.transaction_sub_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
    farm_id         UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    slug            TEXT NOT NULL,
    label_ru        TEXT NOT NULL,
    label_en        TEXT NOT NULL,
    sort_order      SMALLINT NOT NULL DEFAULT 0,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, farm_id, slug)
);

COMMENT ON TABLE public.transaction_sub_categories IS
    'Second-level classification (opex, capex, operationalRevenue, etc.).';

ALTER TABLE public.transaction_sub_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_sub_categories: public read system"
    ON public.transaction_sub_categories FOR SELECT
    USING (is_system = TRUE OR farm_id IS NULL);

CREATE POLICY "tx_sub_categories: farm members read"
    ON public.transaction_sub_categories FOR SELECT
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

CREATE POLICY "tx_sub_categories: farm admins manage"
    ON public.transaction_sub_categories FOR ALL
    USING (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = transaction_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- 3. opex_sub_categories
-- ---------------------------------------------------------------------------
-- Leaf-level OPEX classification with forecasting metadata and keyword hints.
-- Mirrors the 13-element opexCategories array in AppContext.jsx.
-- Per-farm custom entries are supported via farm_id.
-- ---------------------------------------------------------------------------
CREATE TYPE public.forecasting_type AS ENUM ('trend', 'fixed', 'manual');

CREATE TABLE public.opex_sub_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_category_id     UUID NOT NULL
                            REFERENCES public.transaction_sub_categories(id)
                            ON DELETE CASCADE,
    farm_id             UUID REFERENCES public.farms(id) ON DELETE CASCADE,
    slug                TEXT NOT NULL,           -- 'fuel' | 'salary' | 'seeds' | ...
    label_ru            TEXT NOT NULL,
    label_en            TEXT NOT NULL,
    forecasting_type    public.forecasting_type NOT NULL DEFAULT 'fixed',
    -- Keyword hints used by the client-side heuristic parser and server-side
    -- text classification.  Stored as a text array for easy extension.
    keywords_ru         TEXT[] NOT NULL DEFAULT '{}',
    keywords_en         TEXT[] NOT NULL DEFAULT '{}',
    sort_order          SMALLINT NOT NULL DEFAULT 0,
    is_system           BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sub_category_id, farm_id, slug)
);

COMMENT ON TABLE public.opex_sub_categories IS
    'Leaf-level OPEX classification. Migrated from the hard-coded opexCategories '
    'array in AppContext.jsx. forecasting_type drives the monthly projection logic.';

CREATE INDEX idx_opex_sub_slug ON public.opex_sub_categories (slug);

CREATE TRIGGER opex_sub_categories_updated_at
    BEFORE UPDATE ON public.opex_sub_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.opex_sub_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opex_sub_categories: public read system"
    ON public.opex_sub_categories FOR SELECT
    USING (is_system = TRUE OR farm_id IS NULL);

CREATE POLICY "opex_sub_categories: farm members read"
    ON public.opex_sub_categories FOR SELECT
    USING (
        farm_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = opex_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.status = 'active'
        )
    );

CREATE POLICY "opex_sub_categories: farm admins manage"
    ON public.opex_sub_categories FOR ALL
    USING (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = opex_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    )
    WITH CHECK (
        farm_id IS NOT NULL AND is_system = FALSE AND EXISTS (
            SELECT 1 FROM public.farm_memberships fm
            WHERE fm.farm_id = opex_sub_categories.farm_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
              AND fm.status = 'active'
        )
    );

-- ---------------------------------------------------------------------------
-- 4. Add FK references on transactions (non-breaking, nullable)
-- ---------------------------------------------------------------------------
-- We keep the existing text columns (category, sub_category) as the source
-- of truth until a data backfill migration assigns the FK values.
-- Both columns become nullable FKs alongside the old text fields.
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions
    ADD COLUMN category_id     UUID REFERENCES public.transaction_categories(id)     ON DELETE SET NULL,
    ADD COLUMN sub_category_id UUID REFERENCES public.transaction_sub_categories(id)  ON DELETE SET NULL,
    ADD COLUMN opex_sub_id     UUID REFERENCES public.opex_sub_categories(id)         ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions.category      IS 'Legacy text slug; kept for backward compat. Use category_id going forward.';
COMMENT ON COLUMN public.transactions.sub_category  IS 'Legacy text slug; kept for backward compat. Use sub_category_id / opex_sub_id.';

-- ---------------------------------------------------------------------------
-- 5. Seed system-level categories
-- ---------------------------------------------------------------------------
-- Mirrors the application's current hard-coded classification hierarchy.
-- These rows are immutable system records (is_system = TRUE, farm_id = NULL).
-- ---------------------------------------------------------------------------

-- Top-level categories
INSERT INTO public.transaction_categories (id, farm_id, slug, label_ru, label_en, sort_order, is_system)
VALUES
    ('c1000000-0000-0000-0000-000000000001', NULL, 'income',  'Доход',  'Income',  1, TRUE),
    ('c1000000-0000-0000-0000-000000000002', NULL, 'expense', 'Расход', 'Expense', 2, TRUE)
ON CONFLICT DO NOTHING;

-- Sub-categories under 'expense'
INSERT INTO public.transaction_sub_categories (id, category_id, farm_id, slug, label_ru, label_en, sort_order, is_system)
VALUES
    ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', NULL, 'opex',  'Операционные расходы', 'Operating Expenses', 1, TRUE),
    ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', NULL, 'capex', 'Капитальные расходы',  'Capital Expenses',   2, TRUE)
ON CONFLICT DO NOTHING;

-- Sub-categories under 'income'
INSERT INTO public.transaction_sub_categories (id, category_id, farm_id, slug, label_ru, label_en, sort_order, is_system)
VALUES
    ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', NULL, 'operationalRevenue', 'Выручка от реализации', 'Operational Revenue', 1, TRUE),
    ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', NULL, 'subsidies',          'Субсидии',              'Subsidies',           2, TRUE),
    ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', NULL, 'assetSale',          'Продажа активов',       'Asset Sale',          3, TRUE)
ON CONFLICT DO NOTHING;

-- OPEX leaf categories (mirrors AppContext.jsx opexCategories array exactly)
INSERT INTO public.opex_sub_categories
    (id, sub_category_id, farm_id, slug, label_ru, label_en, forecasting_type, keywords_ru, keywords_en, sort_order, is_system)
VALUES
    (
        'c3000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'fuel', 'Топливо', 'Fuel', 'trend',
        ARRAY['топлив','бензин','дизель','солярк','пропан'],
        ARRAY['fuel','petrol','diesel','solyarka','propan'],
        1, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000002',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'salary', 'Зарплата', 'Salary', 'fixed',
        ARRAY['зарплат','оклад','проезд','билет','виза','экзамен','патент','сертификат'],
        ARRAY['salary','travel','visa','exam','patent','certificate'],
        2, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000003',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'food', 'Питание', 'Food', 'trend',
        ARRAY['еда','продукт','пищ','хлеб','молоко','куриц','мясо','яйц','яиц'],
        ARRAY['food','bread','milk','chicken','meat','egg'],
        3, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000004',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'inventory', 'Инвентарь', 'Inventory', 'fixed',
        ARRAY['запчаст','деталь','инвентар','гвозд'],
        ARRAY['spare','part','inventory','nail'],
        4, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000005',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'tools', 'Инструменты', 'Tools', 'fixed',
        ARRAY['инструмент','лопат','грабл','секатор','пила'],
        ARRAY['tool'],
        5, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000006',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'seeds', 'Семена', 'Seeds', 'fixed',
        ARRAY['семен','рассад','сажен'],
        ARRAY['seed','plant'],
        6, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000007',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'fertilizers', 'Удобрения', 'Fertilizers', 'trend',
        ARRAY['удобрен','навоз','селитр','карбамид','фосфат'],
        ARRAY['fertilizer','nitrate'],
        7, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000008',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'pesticides', 'Пестициды', 'Pesticides', 'fixed',
        ARRAY['пестицид','гербицид','инсектицид','фунгицид','стомп','бандур','деметр','китайк','би-58','гаучо','лямбда','цигалотрин','самум'],
        ARRAY['pesticide','herbicide','stomp','bandur','demetra'],
        8, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000009',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'irrigation', 'Орошение', 'Irrigation', 'trend',
        ARRAY['насос','орошен','полив','вода','водовоз','шланг','капельн','поле'],
        ARRAY['pump','irrigate','field'],
        9, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000010',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'utilities', 'Коммунальные', 'Utilities', 'fixed',
        ARRAY['свет','электроэнерг','электричеств','энергоснабжен','энерго','энерг','коммунал','газ','счет','квитанц'],
        ARRAY['utilities','electricity','energy','bill','invoice'],
        10, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000011',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'contractLabor', 'Наёмный труд', 'Contract Labor', 'fixed',
        ARRAY['сезон','рабоч','найм','бригад'],
        ARRAY['seasonal','labor','hired'],
        11, TRUE
    ),
    (
        'c3000000-0000-0000-0000-000000000012',
        'c2000000-0000-0000-0000-000000000001', NULL,
        'construction', 'Строительство', 'Construction', 'fixed',
        ARRAY['строй','кирпич','цемент','доск','ремонт'],
        ARRAY['build','construction'],
        12, TRUE
    )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT ALL ON public.transaction_categories     TO authenticated;
GRANT ALL ON public.transaction_sub_categories TO authenticated;
GRANT ALL ON public.opex_sub_categories        TO authenticated;
GRANT USAGE ON TYPE public.forecasting_type    TO authenticated;
