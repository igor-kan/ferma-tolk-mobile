-- =============================================================================
-- Seed: Development / local environment only
-- Project: Ferma.Tolk
-- Tickets:  FT-004, FT-005
-- =============================================================================
-- Applied by `supabase db reset` after all migrations.
-- MUST NOT be applied in staging or production environments.
-- =============================================================================

-- ============================================================
-- AUTH USER  (local Supabase stack only)
-- ============================================================
-- On hosted Supabase, create test users via the Dashboard or Admin API.
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    aud,
    role
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@ferma.tolk',
    -- bcrypt hash of 'devpassword123' (cost 10) — local dev only
    '$2a$10$PgjZ1BZOUA/qomBLnbMXjuiuSHFbHFaWDBEMOnCYyEk0sdJiKpL9W',
    now(), now(), now(),
    '{"security_hint": "Любимая культура", "farm_name": "Тестовая ферма", "currency_code": "KZT", "timezone": "Asia/Almaty"}',
    'authenticated',
    'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PUBLIC PROFILE
-- (trigger handles this on real sign-up; explicit here for seed reliability)
-- ============================================================
INSERT INTO public.users (id, email, security_hint)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@ferma.tolk',
    'Любимая культура'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FARM  (personal farm for dev user)
-- ============================================================
INSERT INTO public.farms (id, name, currency_code, timezone)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'Тестовая ферма',
    'KZT',
    'Asia/Almaty'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FARM MEMBERSHIP  (dev user = owner)
-- ============================================================
INSERT INTO public.farm_memberships (farm_id, user_id, role, status, accepted_at)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'owner', 'active', now()
)
ON CONFLICT (farm_id, user_id) DO NOTHING;

-- ============================================================
-- USER PREFERENCES
-- ============================================================
INSERT INTO public.user_preferences (user_id, language, default_farm_id)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'ru',
    'f0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- PROJECTS  (belong to the personal farm)
-- ============================================================
INSERT INTO public.projects (id, user_id, farm_id, slug, label)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'onion',        'Лук (поле)'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'watermelon',   'Арбуз (поле)'),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'greenhouse',   'Теплица'),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'all_projects', 'Общие (все проекты)')
ON CONFLICT (user_id, slug) DO NOTHING;

-- ============================================================
-- TRANSACTIONS  (reference farm_id + FK category columns)
-- ============================================================
INSERT INTO public.transactions (
    id, user_id, farm_id, project_id,
    type, category, sub_category,
    category_id, sub_category_id, opex_sub_id,
    amount, liters, fuel_type, is_fuel, description, entry_date
) VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'income', 'operationalRevenue', NULL,
        'c1000000-0000-0000-0000-000000000001',  -- income
        'c2000000-0000-0000-0000-000000000003',  -- operationalRevenue
        NULL,
        85000, NULL, NULL, FALSE,
        'Продажа лука (первый сбор)',
        now() - INTERVAL '10 days'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000004',
        'expense', 'opex', 'fuel',
        'c1000000-0000-0000-0000-000000000002',  -- expense
        'c2000000-0000-0000-0000-000000000001',  -- opex
        'c3000000-0000-0000-0000-000000000001',  -- fuel
        3200, 40, 'diesel', TRUE,
        'Заправка трактора (дизель)',
        now() - INTERVAL '8 days'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000004',
        'expense', 'opex', 'salary',
        'c1000000-0000-0000-0000-000000000002',
        'c2000000-0000-0000-0000-000000000001',
        'c3000000-0000-0000-0000-000000000002',  -- salary
        15000, NULL, NULL, FALSE,
        'Зарплата бригаде (апрель)',
        now() - INTERVAL '5 days'
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'expense', 'opex', 'seeds',
        'c1000000-0000-0000-0000-000000000002',
        'c2000000-0000-0000-0000-000000000001',
        'c3000000-0000-0000-0000-000000000006',  -- seeds
        4500, NULL, NULL, FALSE,
        'Семена арбуза (импортные)',
        now() - INTERVAL '3 days'
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003',
        'income', 'operationalRevenue', NULL,
        'c1000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000003',
        NULL,
        12000, NULL, NULL, FALSE,
        'Продажа огурцов (теплица)',
        now() - INTERVAL '1 day'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DESCRIPTION MAPPINGS  (with farm_id)
-- ============================================================
INSERT INTO public.description_mappings (user_id, farm_id, description_key, sub_category_id)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'заправка трактора (дизель)', 'fuel'),
    ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'зарплата бригаде (апрель)',  'salary'),
    ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'семена арбуза (импортные)',  'seeds')
ON CONFLICT (user_id, description_key) DO NOTHING;

-- ============================================================
-- FORECAST ADJUSTMENTS (sample)
-- ============================================================
INSERT INTO public.forecast_adjustments (user_id, farm_id, year, month, category_id, delta)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 2026, 3, 'fuel',   500),
    ('00000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 2026, 3, 'salary', -200)
ON CONFLICT (user_id, year, month, category_id) DO NOTHING;

-- ============================================================
-- CHAT MESSAGES (sample history)
-- ============================================================
INSERT INTO public.chat_messages (user_id, role, content)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'bot',  'Привет! Я ваш финансовый ассистент. Чем могу помочь?'),
    ('00000000-0000-0000-0000-000000000001', 'user', 'Покажи расходы за этот месяц'),
    ('00000000-0000-0000-0000-000000000001', 'bot',  'За текущий месяц расходы составили 22 700 ₸.')
ON CONFLICT DO NOTHING;
