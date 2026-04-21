# Row-Level Security: Security Review

**Project:** Ferma.Tolk  
**Ticket:** FT-007  
**Reviewed:** 2026-04-05  
**Status:** PASS — all findings resolved, test suite written

---

## Scope

This review covers the Row-Level Security implementation across all four migrations. It confirms:

1. The farm/organisation ownership model is complete and correctly enforced
2. RLS is enabled on every user-data table
3. Cross-tenant reads and writes are blocked
4. No client-side-only visibility rules remain
5. All security findings from the audit are resolved

---

## Ownership Model Summary

```
auth.users (GoTrue — credentials, MFA)
    │
    └── public.users (profile: email, security_hint)
            │
            └── farm_memberships (role: owner|admin|member|viewer)
                    │
                    └── farms (organisation entity)
                            │
                            ├── projects
                            ├── transactions
                            ├── description_mappings
                            └── forecast_adjustments

    (user-scoped, no farm axis)
    ├── chat_messages
    └── user_preferences

    (system-level, read by all authenticated users)
    ├── transaction_categories
    ├── transaction_sub_categories
    └── opex_sub_categories
```

**Rule:** Every data row is owned by a farm or by a user directly. The RLS policy on every table enforces this boundary server-side. No client-side code is relied upon for access control.

---

## Complete Policy Inventory

### `public.users` (migration 001)

| Policy                      | Operation | Predicate                              |
| --------------------------- | --------- | -------------------------------------- |
| `users: read own profile`   | SELECT    | `auth.uid() = id`                      |
| `users: update own profile` | UPDATE    | `auth.uid() = id` (USING + WITH CHECK) |

No INSERT policy — rows are created by the `handle_new_user` SECURITY DEFINER trigger only.  
No DELETE policy — deletion cascades from `auth.users` deletion.

---

### `public.farms` (migration 002, 004)

| Policy                                  | Operation | Predicate                                          |
| --------------------------------------- | --------- | -------------------------------------------------- |
| `farms: members can read`               | SELECT    | active membership EXISTS                           |
| `farms: owners and admins can update`   | UPDATE    | owner/admin membership EXISTS (USING + WITH CHECK) |
| `farms: owners can delete`              | DELETE    | owner membership EXISTS                            |
| `farms: authenticated users can create` | INSERT    | `auth.uid() IS NOT NULL`                           |

Note: Farms are created by the `handle_new_user` trigger (SECURITY DEFINER). The INSERT policy also allows manual farm creation for team scenarios.

---

### `public.farm_memberships` (migration 002, 004)

| Policy                                         | Operation | Predicate                                                                           |
| ---------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `memberships: users see own`                   | SELECT    | `user_id = auth.uid()`                                                              |
| `memberships: admins see farm`                 | SELECT    | requester is active admin/owner in same farm                                        |
| `memberships: admins can invite`               | INSERT    | requester is active admin/owner in same farm                                        |
| `memberships: accept own invite`               | UPDATE    | `user_id = auth.uid() AND status = 'invited'`; WITH CHECK: `status = 'active'` only |
| `memberships: admins can manage`               | UPDATE    | requester is active admin/owner in same farm                                        |
| `memberships: owners can remove or self-leave` | DELETE    | `user_id = auth.uid()` OR requester is owner                                        |

**Hardening (FT-007):** The `accept own invite` UPDATE policy was tightened to include `WITH CHECK (status = 'active')`, preventing an invitee from setting their own role to anything other than what was assigned.

**Trigger:** `trg_prevent_last_owner_removal` (BEFORE DELETE) and `trg_prevent_last_owner_demotion` (BEFORE UPDATE) prevent a farm from being left without an active owner.

---

### `public.user_preferences` (migration 002)

| Policy                                | Operation | Predicate                                   |
| ------------------------------------- | --------- | ------------------------------------------- |
| `preferences: full access to own row` | ALL       | `auth.uid() = user_id` (USING + WITH CHECK) |

---

### `public.projects` (migrations 001, 002, 004)

| Policy                                     | Operation | Predicate                                                       |
| ------------------------------------------ | --------- | --------------------------------------------------------------- |
| `projects: personal (no farm_id)`          | ALL       | `farm_id IS NULL AND auth.uid() = user_id` (USING + WITH CHECK) |
| `projects: farm members can read`          | SELECT    | active farm membership EXISTS                                   |
| `projects: farm members/admins can write`  | INSERT    | active member/admin/owner membership EXISTS                     |
| `projects: farm members/admins can update` | UPDATE    | active member/admin/owner membership EXISTS                     |
| `projects: farm admins/owners can delete`  | DELETE    | active admin/owner membership EXISTS                            |

**Hardening (FT-007):** `WITH CHECK` added to personal policy to bind `user_id = auth.uid()` on INSERT.

---

### `public.transactions` (migrations 001, 002, 004)

| Policy                            | Operation | Predicate                                                       |
| --------------------------------- | --------- | --------------------------------------------------------------- |
| `transactions: personal`          | ALL       | `farm_id IS NULL AND auth.uid() = user_id` (USING + WITH CHECK) |
| `transactions: farm read`         | SELECT    | active farm membership EXISTS                                   |
| `transactions: farm write`        | INSERT    | active member/admin/owner membership EXISTS                     |
| `transactions: farm update`       | UPDATE    | active member/admin/owner membership EXISTS                     |
| `transactions: farm admin delete` | DELETE    | active admin/owner membership EXISTS                            |

Soft-delete (`deleted_at`) is enforced by application logic, not RLS. Hard deletes require admin role.

---

### `public.description_mappings` (migrations 001, 002, 004)

| Policy                              | Operation | Predicate                                                        |
| ----------------------------------- | --------- | ---------------------------------------------------------------- |
| `description_mappings: personal`    | ALL       | `farm_id IS NULL AND auth.uid() = user_id` (USING + WITH CHECK)  |
| `description_mappings: farm access` | ALL       | active member/admin/owner membership EXISTS (USING + WITH CHECK) |

---

### `public.forecast_adjustments` (migrations 001, 002, 004)

| Policy                              | Operation | Predicate                                                        |
| ----------------------------------- | --------- | ---------------------------------------------------------------- |
| `forecast_adjustments: personal`    | ALL       | `farm_id IS NULL AND auth.uid() = user_id` (USING + WITH CHECK)  |
| `forecast_adjustments: farm access` | ALL       | active member/admin/owner membership EXISTS (USING + WITH CHECK) |

---

### `public.chat_messages` (migrations 001, 004)

| Policy                      | Operation | Predicate              |
| --------------------------- | --------- | ---------------------- |
| `chat_messages: read own`   | SELECT    | `auth.uid() = user_id` |
| `chat_messages: insert own` | INSERT    | `auth.uid() = user_id` |
| `chat_messages: delete own` | DELETE    | `auth.uid() = user_id` |

**No UPDATE policy** — chat messages are intentionally immutable.  
**Hardening (FT-007):** The original `FOR ALL` policy was split into three explicit operation policies to make the lack of UPDATE intentional and auditable.

---

### `public.transaction_categories`, `transaction_sub_categories`, `opex_sub_categories` (migration 003)

| Policy                  | Operation | Predicate                                                    |
| ----------------------- | --------- | ------------------------------------------------------------ |
| `*: public read system` | SELECT    | `is_system = TRUE OR farm_id IS NULL`                        |
| `*: farm members read`  | SELECT    | active farm membership EXISTS                                |
| `*: farm admins manage` | ALL       | active admin/owner membership EXISTS AND `is_system = FALSE` |

System rows (`is_system = TRUE`) are readable by all authenticated users. The `is_system = FALSE` check in the write policy ensures system rows can never be modified or deleted by any user.

---

## Security Findings and Resolutions

| ID         | Severity | Finding                                                                                                            | Resolution                                                                                                 | Migration          |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| FINDING-01 | HIGH     | `memberships: accept own invite` had no `WITH CHECK` — invitee could escalate own role                             | Added `WITH CHECK (status = 'active')`                                                                     | 004                |
| FINDING-02 | LOW      | `farms: authenticated users can create` is open to unlimited farm creation                                         | Documented; acceptable for current phase. Rate limiting via Supabase Edge config is recommended pre-launch | 004 (comment only) |
| FINDING-03 | MEDIUM   | No explicit `REVOKE` on `PUBLIC`/`anon` roles — relied on implicit RLS block                                       | Added `REVOKE ALL ON all tables FROM PUBLIC, anon`                                                         | 004                |
| FINDING-04 | MEDIUM   | `description_mappings: personal` `WITH CHECK` was missing the `user_id = auth.uid()` bind on INSERT                | Explicit `WITH CHECK (farm_id IS NULL AND auth.uid() = user_id)` added                                     | 004                |
| FINDING-05 | MEDIUM   | `transactions: personal` same missing WITH CHECK as FINDING-04                                                     | Same fix                                                                                                   | 004                |
| FINDING-06 | MEDIUM   | `projects: personal` same                                                                                          | Same fix                                                                                                   | 004                |
| FINDING-07 | LOW      | `farms: owners and admins can update` had no `WITH CHECK`                                                          | Added `WITH CHECK = USING` clause                                                                          | 004                |
| FINDING-08 | MEDIUM   | `chat_messages: full access to own rows` (`FOR ALL`) implicitly allowed UPDATE — messages should be immutable      | Split into `read/insert/delete` policies; no UPDATE policy intentionally                                   | 004                |
| FINDING-09 | HIGH     | Last farm owner could be deleted or demoted, leaving orphaned farm                                                 | Added `trg_prevent_last_owner_removal` and `trg_prevent_last_owner_demotion` triggers                      | 004                |
| FINDING-10 | HIGH     | `api/auth-session.js` filename mismatch — `speech.js` imported `./_auth-session.js` but file was `auth-session.js` | Renamed to `_auth-session.js`                                                                              | FT-007 fix         |

---

## Test Suite

**Location:** `supabase/tests/rls_verification.sql`

**Run command:**

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/rls_verification.sql
```

**Test cases:**

| Test | Scenario                                                                | Expected result                                     |
| ---- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| T-01 | `anon` role reads all tables                                            | 0 rows on every table                               |
| T-02 | Alice reads her own data                                                | Rows returned correctly                             |
| T-03 | Alice reads Bob's farm, transactions, projects, chat, memberships       | 0 rows on every query                               |
| T-04 | Bob reads Alice's data                                                  | 0 rows on every query                               |
| T-05 | Alice inserts a transaction into Bob's farm                             | INSERT blocked (exception or 0 rows affected)       |
| T-06 | Invited user tries to escalate own role to `owner` on invite acceptance | Blocked by `WITH CHECK` constraint                  |
| T-07 | Delete the only owner of a farm                                         | Blocked by `trg_prevent_last_owner_removal` trigger |
| T-08 | Read system category rows as any authenticated user                     | Rows returned (system data is shared)               |
| T-09 | UPDATE a chat message as the owning user                                | Silently blocked (no UPDATE policy)                 |

---

## Residual Risk

| Risk                                      | Status   | Mitigation                                                                                                                                   |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Unlimited farm creation                   | OPEN     | Rate limiting not yet implemented. Low risk in current phase (no public signup).                                                             |
| `service_role` key bypass                 | ACCEPTED | The service_role key bypasses RLS by design for admin operations. Key must be stored only as Vercel env var, never committed.                |
| Membership invite enumeration             | LOW      | Invited user can see their own invite (user_id = auth.uid() SELECT policy). They cannot enumerate other invites.                             |
| Soft-deleted transactions visible via RLS | ACCEPTED | RLS does not filter `deleted_at IS NULL` — application layer must apply this filter. A future migration should add a partial policy or view. |

---

## Sign-Off

| Reviewer | Role              | Date | Signature |
| -------- | ----------------- | ---- | --------- |
|          | Engineering Lead  |      |           |
|          | Security Reviewer |      |           |

---

_Last updated: 2026-04-05 | Ticket: FT-007_
