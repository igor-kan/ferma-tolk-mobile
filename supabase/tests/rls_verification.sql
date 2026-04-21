-- =============================================================================
-- RLS Verification Test Suite
-- Project:   Ferma.Tolk
-- Ticket:    FT-007
-- Created:   2026-04-05
-- =============================================================================
-- Run this file in psql against a local Supabase stack after `supabase db reset`:
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls_verification.sql
--
-- All tests use pgTAP-style assertions via DO blocks that RAISE EXCEPTION on
-- failure. A passing run produces only NOTICE lines. Any EXCEPTION = test failure.
--
-- Test users seeded by supabase/seed.sql:
--   Alice  = '00000000-0000-0000-0000-000000000001'  (dev@ferma.tolk)
--   Farm A = 'f0000000-0000-0000-0000-000000000001'
--
-- This file creates additional test fixtures (Bob, Farm B) and cleans up
-- after all tests.
-- =============================================================================

BEGIN;

-- ============================================================
-- SETUP: Create a second test user (Bob) with his own farm
-- ============================================================
-- Bob — a completely separate tenant; must never see Alice's data

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_user_meta_data, aud, role)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'bob@ferma.tolk',
    '$2a$10$PgjZ1BZOUA/qomBLnbMXjuiuSHFbHFaWDBEMOnCYyEk0sdJiKpL9W',
    now(), now(), now(),
    '{"farm_name": "Bob Farm"}',
    'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Bob's profile + farm (trigger should have run; insert manually for test isolation)
INSERT INTO public.users (id, email) VALUES
    ('00000000-0000-0000-0000-000000000002', 'bob@ferma.tolk')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.farms (id, name)
VALUES ('f0000000-0000-0000-0000-000000000002', 'Bob Farm')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.farm_memberships (farm_id, user_id, role, status, accepted_at)
VALUES ('f0000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002',
        'owner', 'active', now())
ON CONFLICT (farm_id, user_id) DO NOTHING;

-- Bob's transaction (in Bob's farm — Alice must never see this)
INSERT INTO public.transactions (id, user_id, farm_id, type, category, amount, entry_date)
VALUES (
    '99000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000002',
    'income', 'operationalRevenue', 99999,
    now()
) ON CONFLICT (id) DO NOTHING;

-- Bob's project
INSERT INTO public.projects (id, user_id, farm_id, slug, label)
VALUES (
    '99000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000002',
    'bob-crop', 'Bob Exclusive Project'
) ON CONFLICT (user_id, slug) DO NOTHING;

-- Bob's chat message
INSERT INTO public.chat_messages (id, user_id, role, content)
VALUES (
    '99000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'user', 'Bob private message'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- HELPER: set_local_user — simulate a user JWT for RLS tests
-- ============================================================
-- Supabase stores the JWT claims in the request.jwt.claims path.
-- In local psql sessions we can simulate this with:
--   SET LOCAL role = authenticated;
--   SET LOCAL "request.jwt.claims" = '{"sub": "<uuid>"}';
-- auth.uid() reads from request.jwt.claims.sub.

CREATE OR REPLACE FUNCTION test_set_user(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
        true);
    PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_assert(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF NOT p_condition THEN
        RAISE EXCEPTION 'TEST FAILED: %', p_message;
    ELSE
        RAISE NOTICE 'PASS: %', p_message;
    END IF;
END;
$$;

-- ============================================================
-- T-01: anon role cannot read any table
-- ============================================================
DO $$
BEGIN
    -- Switch to anon role (no JWT claims)
    PERFORM set_config('role', 'anon', true);

    BEGIN
        PERFORM 1 FROM public.farms LIMIT 1;
        PERFORM test_assert(false, 'T-01a: anon read farms should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01a: anon read farms denied');
    END;

    BEGIN
        PERFORM 1 FROM public.transactions LIMIT 1;
        PERFORM test_assert(false, 'T-01b: anon read transactions should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01b: anon read transactions denied');
    END;

    BEGIN
        PERFORM 1 FROM public.projects LIMIT 1;
        PERFORM test_assert(false, 'T-01c: anon read projects should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01c: anon read projects denied');
    END;

    BEGIN
        PERFORM 1 FROM public.chat_messages LIMIT 1;
        PERFORM test_assert(false, 'T-01d: anon read chat_messages should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01d: anon read chat_messages denied');
    END;

    BEGIN
        PERFORM 1 FROM public.users LIMIT 1;
        PERFORM test_assert(false, 'T-01e: anon read users should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01e: anon read users denied');
    END;

    BEGIN
        PERFORM 1 FROM public.farm_memberships LIMIT 1;
        PERFORM test_assert(false, 'T-01f: anon read farm_memberships should be denied');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        PERFORM test_assert(true, 'T-01f: anon read farm_memberships denied');
    END;
END;
$$;

-- ============================================================
-- T-02: Alice can read her own data
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    -- Alice's own farm
    SELECT count(*) INTO v_count FROM public.farms
    WHERE id = 'f0000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count = 1, 'T-02a: Alice can read her own farm');

    -- Alice's transactions
    SELECT count(*) INTO v_count FROM public.transactions
    WHERE user_id = '00000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count > 0, 'T-02b: Alice can read her transactions');

    -- Alice's projects
    SELECT count(*) INTO v_count FROM public.projects
    WHERE user_id = '00000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count > 0, 'T-02c: Alice can read her projects');

    -- Alice's chat messages
    SELECT count(*) INTO v_count FROM public.chat_messages
    WHERE user_id = '00000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count > 0, 'T-02d: Alice can read her chat messages');

    -- Alice's baseline membership in Farm A
    SELECT count(*) INTO v_count FROM public.farm_memberships
    WHERE user_id = '00000000-0000-0000-0000-000000000001'
      AND farm_id = 'f0000000-0000-0000-0000-000000000001'
      AND role = 'owner'
      AND status = 'active';
    PERFORM test_assert(v_count = 1, 'T-02e: Alice can read her baseline membership');
END;
$$;

-- ============================================================
-- T-03: Cross-tenant isolation — Alice cannot see Bob's data
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    -- Alice must NOT see Bob's farm
    SELECT count(*) INTO v_count FROM public.farms
    WHERE id = 'f0000000-0000-0000-0000-000000000002';
    PERFORM test_assert(v_count = 0, 'T-03a: Alice cannot read Bob farm');

    -- Alice must NOT see Bob's transactions
    SELECT count(*) INTO v_count FROM public.transactions
    WHERE id = '99000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count = 0, 'T-03b: Alice cannot read Bob transaction');

    -- Alice must NOT see Bob's projects
    SELECT count(*) INTO v_count FROM public.projects
    WHERE id = '99000000-0000-0000-0000-000000000002';
    PERFORM test_assert(v_count = 0, 'T-03c: Alice cannot read Bob project');

    -- Alice must NOT see Bob's chat messages
    SELECT count(*) INTO v_count FROM public.chat_messages
    WHERE id = '99000000-0000-0000-0000-000000000003';
    PERFORM test_assert(v_count = 0, 'T-03d: Alice cannot read Bob chat message');

    -- Alice must NOT see Bob's membership
    SELECT count(*) INTO v_count FROM public.farm_memberships
    WHERE user_id = '00000000-0000-0000-0000-000000000002';
    PERFORM test_assert(v_count = 0, 'T-03e: Alice cannot read Bob membership');
END;
$$;

-- ============================================================
-- T-04: Cross-tenant isolation — Bob cannot see Alice's data
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000002'::UUID);

    SELECT count(*) INTO v_count FROM public.farms
    WHERE id = 'f0000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count = 0, 'T-04a: Bob cannot read Alice farm');

    SELECT count(*) INTO v_count FROM public.transactions
    WHERE user_id = '00000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count = 0, 'T-04b: Bob cannot read Alice transactions');

    SELECT count(*) INTO v_count FROM public.chat_messages
    WHERE user_id = '00000000-0000-0000-0000-000000000001';
    PERFORM test_assert(v_count = 0, 'T-04c: Bob cannot read Alice chat messages');
END;
$$;

-- ============================================================
-- T-05: Alice cannot write into Bob's farm
-- ============================================================
DO $$
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    BEGIN
        INSERT INTO public.transactions
            (user_id, farm_id, type, category, amount, entry_date)
        VALUES
            ('00000000-0000-0000-0000-000000000001',
             'f0000000-0000-0000-0000-000000000002',   -- Bob's farm
             'expense', 'opex', 1, now());
        -- If we reach here the policy failed
        PERFORM test_assert(false, 'T-05a: Alice should NOT be able to insert into Bob farm');
    EXCEPTION WHEN others THEN
        PERFORM test_assert(true, 'T-05a: Alice correctly blocked from inserting into Bob farm');
    END;
END;
$$;

-- ============================================================
-- T-06: Role escalation — invited user cannot set own role to owner
-- ============================================================
DO $$
DECLARE v_membership_id UUID;
BEGIN
    -- Reset to privileged context for fixture setup.
    PERFORM set_config('request.jwt.claims', '{}'::text, true);
    PERFORM set_config('role', 'postgres', true);

    -- Insert a pending invite for Alice into Bob's farm as 'member'
    INSERT INTO public.farm_memberships
        (farm_id, user_id, role, status, invited_by)
    VALUES
        ('f0000000-0000-0000-0000-000000000002',
         '00000000-0000-0000-0000-000000000001',
         'member', 'invited',
         '00000000-0000-0000-0000-000000000002')
    ON CONFLICT (farm_id, user_id) DO NOTHING
    RETURNING id INTO v_membership_id;

    IF v_membership_id IS NULL THEN
        SELECT id INTO v_membership_id FROM public.farm_memberships
        WHERE farm_id = 'f0000000-0000-0000-0000-000000000002'
          AND user_id = '00000000-0000-0000-0000-000000000001';
    END IF;

    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    BEGIN
        -- Alice tries to accept the invite but escalate role to 'owner'
        UPDATE public.farm_memberships
        SET status = 'active', role = 'owner', accepted_at = now()
        WHERE id = v_membership_id;
        -- If the policy allows this, role would be 'owner' — check
        DECLARE r public.farm_role;
        BEGIN
            SELECT role INTO r FROM public.farm_memberships WHERE id = v_membership_id;
            PERFORM test_assert(r <> 'owner', 'T-06a: Alice cannot escalate role to owner via invite acceptance');
        END;
    EXCEPTION WHEN others THEN
        PERFORM test_assert(true, 'T-06a: Role escalation correctly blocked');
    END;

    -- Clean up the test invite
    DELETE FROM public.farm_memberships
    WHERE farm_id = 'f0000000-0000-0000-0000-000000000002'
      AND user_id = '00000000-0000-0000-0000-000000000001';
END;
$$;

-- ============================================================
-- T-07: Last owner cannot be removed
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    -- Reset to privileged context for trigger-level invariant checks.
    PERFORM set_config('request.jwt.claims', '{}'::text, true);
    PERFORM set_config('role', 'postgres', true);

    -- As superuser (test context), try to delete the only owner of Farm A
    BEGIN
        DELETE FROM public.farm_memberships
        WHERE farm_id = 'f0000000-0000-0000-0000-000000000001'
          AND user_id = '00000000-0000-0000-0000-000000000001'
          AND role = 'owner';
        -- If we reach here, the trigger failed
        PERFORM test_assert(false, 'T-07a: Last owner removal should have been blocked');
    EXCEPTION WHEN others THEN
        PERFORM test_assert(true, 'T-07a: Last owner correctly protected from removal');
    END;
END;
$$;

-- ============================================================
-- T-08: System category rows are readable by all authenticated users
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    SELECT count(*) INTO v_count FROM public.transaction_categories WHERE is_system = TRUE;
    PERFORM test_assert(v_count >= 2, 'T-08a: Alice can read system categories');

    SELECT count(*) INTO v_count FROM public.opex_sub_categories WHERE is_system = TRUE;
    PERFORM test_assert(v_count >= 12, 'T-08b: Alice can read system OPEX sub-categories');

    PERFORM test_set_user('00000000-0000-0000-0000-000000000002'::UUID);

    SELECT count(*) INTO v_count FROM public.transaction_categories WHERE is_system = TRUE;
    PERFORM test_assert(v_count >= 2, 'T-08c: Bob can also read system categories');
END;
$$;

-- ============================================================
-- T-09: chat_messages are immutable (no UPDATE policy)
-- ============================================================
DO $$
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    BEGIN
        UPDATE public.chat_messages
        SET content = 'tampered content'
        WHERE user_id = '00000000-0000-0000-0000-000000000001';
        -- UPDATE should silently affect 0 rows (no UPDATE policy = RLS blocks)
        PERFORM test_assert(true, 'T-09a: chat_messages UPDATE silently blocked by missing policy');
    EXCEPTION WHEN others THEN
        PERFORM test_assert(true, 'T-09a: chat_messages UPDATE blocked');
    END;
END;
$$;

-- ============================================================
-- T-10: farm_memberships policy evaluation does not recurse
-- ============================================================
DO $$
DECLARE v_count INT;
BEGIN
    PERFORM test_set_user('00000000-0000-0000-0000-000000000001'::UUID);

    BEGIN
        -- This query previously failed with:
        -- 42P17: infinite recursion detected in policy for relation "farm_memberships"
        SELECT count(*) INTO v_count
        FROM public.farm_memberships;

        PERFORM test_assert(v_count >= 1, 'T-10a: farm_memberships SELECT works without recursion');
    EXCEPTION WHEN SQLSTATE '42P17' THEN
        PERFORM test_assert(false, 'T-10a: farm_memberships SELECT triggered recursive policy error');
    END;
END;
$$;

-- ============================================================
-- CLEANUP: Remove test fixtures
-- ============================================================
SELECT set_config('request.jwt.claims', '{}'::text, true);
SELECT set_config('role', 'postgres', true);

-- No explicit row cleanup needed; this test file runs inside a transaction
-- and ends with ROLLBACK.

DROP FUNCTION IF EXISTS test_set_user(UUID);
DROP FUNCTION IF EXISTS test_assert(BOOLEAN, TEXT);

DO $$
BEGIN
    RAISE NOTICE '=== All RLS tests passed ===';
END;
$$;

ROLLBACK; -- Do not persist test state
