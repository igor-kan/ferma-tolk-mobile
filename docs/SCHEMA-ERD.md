# Schema ERD & Design Reference

**Project:** Ferma.Tolk  
**Database:** Supabase PostgreSQL 15  
**Tickets:** FT-004, FT-005  
**Last updated:** 2026-04-05

---

## Table of Contents

1. [Entity Overview](#entity-overview)
2. [Ownership Model](#ownership-model)
3. [ERD — Mermaid Diagram](#erd--mermaid-diagram)
4. [Table Definitions](#table-definitions)
5. [Relationship Reference](#relationship-reference)
6. [RLS Policy Summary](#rls-policy-summary)
7. [Migration Index](#migration-index)
8. [Design Decisions](#design-decisions)

---

## Entity Overview

| Table                               | Migration         | Purpose                                | Owner Axis       |
| ----------------------------------- | ----------------- | -------------------------------------- | ---------------- |
| `auth.users`                        | Supabase built-in | Credential store (GoTrue)              | —                |
| `public.users`                      | 001               | Application profile                    | self             |
| `public.farms`                      | 002               | Organisation / farm entity             | farm_memberships |
| `public.farm_memberships`           | 002               | User ↔ Farm junction with role         | user + farm      |
| `public.user_preferences`           | 002               | Per-user UI state & config             | self             |
| `public.projects`                   | 001 + 002         | Crop / operational units within a farm | farm             |
| `public.transactions`               | 001 + 003         | Financial records (income/expense)     | farm             |
| `public.description_mappings`       | 001 + 002         | Auto-classification hints              | farm             |
| `public.forecast_adjustments`       | 001 + 002         | Manual budget adjustments              | farm             |
| `public.chat_messages`              | 001               | Assistant conversation history         | user             |
| `public.transaction_categories`     | 003               | Top-level type: income / expense       | system + farm    |
| `public.transaction_sub_categories` | 003               | Second-level: opex, capex, revenue…    | system + farm    |
| `public.opex_sub_categories`        | 003               | Leaf OPEX classification with keywords | system + farm    |

---

## Ownership Model

Every row in the schema is owned by exactly one of:

### User-owned (personal data, `user_id = auth.uid()`)

- `public.users` — identity profile
- `public.user_preferences` — UI preferences
- `public.chat_messages` — assistant history

### Farm-owned (shared across members, `farm_id` + membership check)

- `public.farms` — the organisation itself
- `public.projects` — crop/operational units
- `public.transactions` — financial records
- `public.description_mappings` — classification hints
- `public.forecast_adjustments` — budget adjustments

### System / global (read-only reference data, no farm_id, `is_system = TRUE`)

- `public.transaction_categories`
- `public.transaction_sub_categories`
- `public.opex_sub_categories`

### Farm-extended reference data (`farm_id IS NOT NULL, is_system = FALSE`)

The three category tables above also support per-farm custom entries that extend the system rows.

### Backward compatibility

All farm-owned tables have both a `user_id` column (from migration 001) and a `farm_id` column (added in migration 002). When `farm_id IS NULL`, the row is treated as personal. The application supplies `farm_id` on all new writes; the null case handles pre-migration data only.

---

## ERD — Mermaid Diagram

```mermaid
erDiagram

    %% ── Auth layer ──────────────────────────────────────────────
    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
    }

    %% ── Identity & membership ────────────────────────────────────
    USERS {
        uuid id PK FK
        text email
        text security_hint
        timestamptz created_at
        timestamptz updated_at
    }

    FARMS {
        uuid id PK
        text name
        text slug
        text country_code
        text currency_code
        text timezone
        timestamptz created_at
        timestamptz updated_at
    }

    FARM_MEMBERSHIPS {
        uuid id PK
        uuid farm_id FK
        uuid user_id FK
        enum role
        enum status
        uuid invited_by FK
        timestamptz accepted_at
    }

    USER_PREFERENCES {
        uuid user_id PK FK
        text language
        smallint selected_month
        smallint selected_year
        uuid default_farm_id FK
    }

    %% ── Business entities ────────────────────────────────────────
    PROJECTS {
        uuid id PK
        uuid user_id FK
        uuid farm_id FK
        text slug
        text label
        timestamptz created_at
    }

    TRANSACTIONS {
        uuid id PK
        uuid user_id FK
        uuid farm_id FK
        uuid project_id FK
        text type
        text category
        text sub_category
        uuid category_id FK
        uuid sub_category_id FK
        uuid opex_sub_id FK
        numeric amount
        numeric liters
        text fuel_type
        boolean is_fuel
        text description
        timestamptz entry_date
        timestamptz deleted_at
    }

    DESCRIPTION_MAPPINGS {
        uuid id PK
        uuid user_id FK
        uuid farm_id FK
        text description_key
        text sub_category_id
        timestamptz created_at
    }

    FORECAST_ADJUSTMENTS {
        uuid id PK
        uuid user_id FK
        uuid farm_id FK
        smallint year
        smallint month
        text category_id
        numeric delta
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid user_id FK
        enum role
        text content
        timestamptz created_at
    }

    %% ── Category reference data ──────────────────────────────────
    TRANSACTION_CATEGORIES {
        uuid id PK
        uuid farm_id FK
        text slug
        text label_ru
        text label_en
        boolean is_system
    }

    TRANSACTION_SUB_CATEGORIES {
        uuid id PK
        uuid category_id FK
        uuid farm_id FK
        text slug
        text label_ru
        text label_en
        boolean is_system
    }

    OPEX_SUB_CATEGORIES {
        uuid id PK
        uuid sub_category_id FK
        uuid farm_id FK
        text slug
        text label_ru
        text label_en
        enum forecasting_type
        text[] keywords_ru
        text[] keywords_en
        boolean is_system
    }

    %% ── Relationships ────────────────────────────────────────────
    AUTH_USERS       ||--|| USERS                   : "extends"
    USERS            ||--o{ FARM_MEMBERSHIPS         : "belongs to"
    FARMS            ||--o{ FARM_MEMBERSHIPS         : "has members"
    USERS            ||--|| USER_PREFERENCES         : "has prefs"
    FARMS            ||--o| USER_PREFERENCES         : "default farm"

    FARMS            ||--o{ PROJECTS                 : "owns"
    USERS            ||--o{ PROJECTS                 : "created by"
    FARMS            ||--o{ TRANSACTIONS             : "owns"
    USERS            ||--o{ TRANSACTIONS             : "entered by"
    PROJECTS         ||--o{ TRANSACTIONS             : "tagged to"

    FARMS            ||--o{ DESCRIPTION_MAPPINGS     : "owns"
    FARMS            ||--o{ FORECAST_ADJUSTMENTS     : "owns"
    USERS            ||--o{ CHAT_MESSAGES            : "owns"

    TRANSACTION_CATEGORIES     ||--o{ TRANSACTION_SUB_CATEGORIES : "has"
    TRANSACTION_SUB_CATEGORIES ||--o{ OPEX_SUB_CATEGORIES        : "has"
    FARMS           ||--o{ TRANSACTION_CATEGORIES     : "extends (farm-level)"
    FARMS           ||--o{ TRANSACTION_SUB_CATEGORIES : "extends (farm-level)"
    FARMS           ||--o{ OPEX_SUB_CATEGORIES         : "extends (farm-level)"

    TRANSACTION_CATEGORIES     ||--o{ TRANSACTIONS             : "classifies"
    TRANSACTION_SUB_CATEGORIES ||--o{ TRANSACTIONS             : "classifies"
    OPEX_SUB_CATEGORIES        ||--o{ TRANSACTIONS             : "classifies"
```

---

## Table Definitions

### `public.users`

Application profile — extends `auth.users`.

| Column          | Type          | Constraints              | Notes                              |
| --------------- | ------------- | ------------------------ | ---------------------------------- |
| `id`            | `UUID`        | PK, FK → `auth.users.id` | Same UUID as GoTrue user           |
| `email`         | `TEXT`        | UNIQUE NOT NULL          | Denormalized from auth for queries |
| `security_hint` | `TEXT`        |                          | Non-secret hint for recovery       |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL DEFAULT now()   |                                    |
| `updated_at`    | `TIMESTAMPTZ` | NOT NULL DEFAULT now()   | Auto-updated by trigger            |

---

### `public.farms`

The top-level organisational entity. A user always belongs to at least one farm (their personal farm, auto-created on registration).

| Column          | Type   | Constraints             | Notes                        |
| --------------- | ------ | ----------------------- | ---------------------------- |
| `id`            | `UUID` | PK                      |                              |
| `name`          | `TEXT` | NOT NULL                | Display name                 |
| `slug`          | `TEXT` | UNIQUE                  | Optional URL-safe identifier |
| `description`   | `TEXT` |                         |                              |
| `country_code`  | `TEXT` | DEFAULT `'KZ'`          | ISO 3166-1                   |
| `currency_code` | `TEXT` | DEFAULT `'KZT'`         | ISO 4217                     |
| `timezone`      | `TEXT` | DEFAULT `'Asia/Almaty'` | IANA tz name                 |
| `logo_url`      | `TEXT` |                         | Supabase Storage URL         |

---

### `public.farm_memberships`

Junction table. One user may be a member of multiple farms with different roles.

| Column        | Type                 | Constraints                  | Notes                                |
| ------------- | -------------------- | ---------------------------- | ------------------------------------ |
| `id`          | `UUID`               | PK                           |                                      |
| `farm_id`     | `UUID`               | FK → `farms.id` CASCADE      |                                      |
| `user_id`     | `UUID`               | FK → `users.id` CASCADE      |                                      |
| `role`        | `farm_role` enum     | NOT NULL DEFAULT `'member'`  | `owner \| admin \| member \| viewer` |
| `status`      | `member_status` enum | NOT NULL DEFAULT `'invited'` | `active \| invited \| suspended`     |
| `invited_by`  | `UUID`               | FK → `users.id` SET NULL     | NULL for owner (self)                |
| `accepted_at` | `TIMESTAMPTZ`        |                              | NULL until invite accepted           |

**Role capabilities:**

| Action                | owner | admin | member | viewer |
| --------------------- | :---: | :---: | :----: | :----: |
| Read all farm data    |   ✓   |   ✓   |   ✓    |   ✓    |
| Add/edit transactions |   ✓   |   ✓   |   ✓    |   —    |
| Add/edit projects     |   ✓   |   ✓   |   ✓    |   —    |
| Invite members        |   ✓   |   ✓   |   —    |   —    |
| Change member roles   |   ✓   |   ✓   |   —    |   —    |
| Delete transactions   |   ✓   |   ✓   |   —    |   —    |
| Edit farm settings    |   ✓   |   ✓   |   —    |   —    |
| Delete farm           |   ✓   |   —   |   —    |   —    |
| Transfer ownership    |   ✓   |   —   |   —    |   —    |

---

### `public.user_preferences`

One row per user. Replaces `agri_selected_month_{uid}` and `agri_selected_year_{uid}` localStorage keys.

| Column            | Type       | Notes                                      |
| ----------------- | ---------- | ------------------------------------------ |
| `user_id`         | `UUID` PK  | FK → `users.id`                            |
| `language`        | `TEXT`     | `'ru'` or `'en'`                           |
| `selected_month`  | `SMALLINT` | 0–11 (JS-indexed)                          |
| `selected_year`   | `SMALLINT` |                                            |
| `default_farm_id` | `UUID`     | FK → `farms.id`, the farm shown by default |

---

### `public.projects`

Crop fields or operational units within a farm. A special `all_projects` slug handles shared/cross-project transactions.

| Column    | Type      | Notes                                      |
| --------- | --------- | ------------------------------------------ |
| `id`      | `UUID` PK |                                            |
| `user_id` | `UUID`    | FK → `users.id` (creator, kept for legacy) |
| `farm_id` | `UUID`    | FK → `farms.id` (owning farm)              |
| `slug`    | `TEXT`    | Unique per `(user_id, slug)`               |
| `label`   | `TEXT`    | Display name                               |

---

### `public.transactions`

Core financial records. Supports soft-delete for audit trail preservation.

| Column            | Type            | Notes                                 |
| ----------------- | --------------- | ------------------------------------- |
| `id`              | `UUID` PK       |                                       |
| `user_id`         | `UUID`          | FK → `users.id` (who entered it)      |
| `farm_id`         | `UUID`          | FK → `farms.id` (owning farm)         |
| `project_id`      | `UUID`          | FK → `projects.id` SET NULL           |
| `type`            | `TEXT`          | `'income'` or `'expense'`             |
| `category`        | `TEXT`          | Legacy text slug (backward compat)    |
| `sub_category`    | `TEXT`          | Legacy text slug (backward compat)    |
| `category_id`     | `UUID`          | FK → `transaction_categories.id`      |
| `sub_category_id` | `UUID`          | FK → `transaction_sub_categories.id`  |
| `opex_sub_id`     | `UUID`          | FK → `opex_sub_categories.id`         |
| `amount`          | `NUMERIC(14,2)` | ≥ 0                                   |
| `liters`          | `NUMERIC(10,3)` | Fuel volume                           |
| `fuel_type`       | `TEXT`          | `petrol \| diesel \| propan \| other` |
| `is_fuel`         | `BOOLEAN`       |                                       |
| `description`     | `TEXT`          | Free text, voice-transcribed          |
| `entry_date`      | `TIMESTAMPTZ`   | User-supplied date of the transaction |
| `deleted_at`      | `TIMESTAMPTZ`   | NULL = active (soft delete)           |

---

### `public.transaction_categories`

Top-level financial type. System rows: `income`, `expense`.

| Column      | Notes                                              |
| ----------- | -------------------------------------------------- |
| `slug`      | `income \| expense`                                |
| `is_system` | TRUE for built-in rows; cannot be deleted          |
| `farm_id`   | NULL for system rows; set for per-farm custom rows |

---

### `public.transaction_sub_categories`

Second-level classification.

System rows under `expense`: `opex`, `capex`  
System rows under `income`: `operationalRevenue`, `subsidies`, `assetSale`

---

### `public.opex_sub_categories`

Leaf-level OPEX classification with forecasting metadata. Migrated from the 13-entry `opexCategories` array in `AppContext.jsx`.

| Column             | Notes                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug`             | `fuel \| salary \| food \| inventory \| tools \| seeds \| fertilizers \| pesticides \| irrigation \| utilities \| contractLabor \| construction` |
| `forecasting_type` | `trend` = extrapolate from pace; `fixed` = use actual; `manual` = user-adjusted                                                                  |
| `keywords_ru`      | `TEXT[]` used by heuristic parser (replaces inline regex)                                                                                        |
| `keywords_en`      | `TEXT[]`                                                                                                                                         |
| `is_system`        | TRUE for built-in rows                                                                                                                           |

---

## Relationship Reference

| From                         | Cardinality | To                           | FK Column                             | On Delete |
| ---------------------------- | ----------- | ---------------------------- | ------------------------------------- | --------- |
| `auth.users`                 | 1:1         | `users`                      | `users.id`                            | CASCADE   |
| `users`                      | 1:N         | `farm_memberships`           | `farm_memberships.user_id`            | CASCADE   |
| `farms`                      | 1:N         | `farm_memberships`           | `farm_memberships.farm_id`            | CASCADE   |
| `users`                      | 1:1         | `user_preferences`           | `user_preferences.user_id`            | CASCADE   |
| `farms`                      | 1:N         | `projects`                   | `projects.farm_id`                    | CASCADE   |
| `farms`                      | 1:N         | `transactions`               | `transactions.farm_id`                | CASCADE   |
| `projects`                   | 1:N         | `transactions`               | `transactions.project_id`             | SET NULL  |
| `farms`                      | 1:N         | `description_mappings`       | `description_mappings.farm_id`        | CASCADE   |
| `farms`                      | 1:N         | `forecast_adjustments`       | `forecast_adjustments.farm_id`        | CASCADE   |
| `users`                      | 1:N         | `chat_messages`              | `chat_messages.user_id`               | CASCADE   |
| `transaction_categories`     | 1:N         | `transaction_sub_categories` | `sub_categories.category_id`          | CASCADE   |
| `transaction_sub_categories` | 1:N         | `opex_sub_categories`        | `opex_sub_categories.sub_category_id` | CASCADE   |
| `transaction_categories`     | 1:N         | `transactions`               | `transactions.category_id`            | SET NULL  |
| `transaction_sub_categories` | 1:N         | `transactions`               | `transactions.sub_category_id`        | SET NULL  |
| `opex_sub_categories`        | 1:N         | `transactions`               | `transactions.opex_sub_id`            | SET NULL  |

---

## RLS Policy Summary

All tables have RLS enabled. Access is never granted to the `anon` role.

| Table                        | Read                       | Write                   | Delete                     |
| ---------------------------- | -------------------------- | ----------------------- | -------------------------- |
| `users`                      | own row                    | own row                 | — (via auth.users cascade) |
| `farms`                      | active members             | owner / admin           | owner                      |
| `farm_memberships`           | own + admin sees farm      | admin (invite)          | owner or self              |
| `user_preferences`           | own row                    | own row                 | own row                    |
| `projects`                   | farm member                | farm member/admin       | farm admin/owner           |
| `transactions`               | farm member                | farm member             | farm admin/owner           |
| `description_mappings`       | farm member                | farm member             | farm member                |
| `forecast_adjustments`       | farm member                | farm member             | farm member                |
| `chat_messages`              | own rows                   | own rows                | own rows                   |
| `transaction_categories`     | all (system) / farm member | farm admin (non-system) | farm admin (non-system)    |
| `transaction_sub_categories` | all (system) / farm member | farm admin (non-system) | farm admin (non-system)    |
| `opex_sub_categories`        | all (system) / farm member | farm admin (non-system) | farm admin (non-system)    |

---

## Migration Index

| File                                    | Ticket | Contents                                                                                                                                                                |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql`                | FT-004 | `users`, `projects`, `transactions`, `description_mappings`, `forecast_adjustments`, `chat_messages`; extensions; `set_updated_at` trigger                              |
| `002_farms_memberships_preferences.sql` | FT-005 | `farms`, `farm_memberships`, `user_preferences`; adds `farm_id` to all data tables; updated `handle_new_user` trigger; role/status enums                                |
| `003_normalise_categories.sql`          | FT-005 | `transaction_categories`, `transaction_sub_categories`, `opex_sub_categories`; adds FK columns to `transactions`; seeds 2 top-level + 7 sub-level + 13 OPEX system rows |

Run order is sequential and strictly required (each migration depends on the previous).

To apply locally:

```bash
supabase db reset    # drops and recreates, applies all migrations + seed
```

To push to a hosted project:

```bash
supabase db push
```

---

## Design Decisions

### Why `farm_id` rather than pure `user_id` on data tables?

The current app is single-user but the domain is inherently multi-person (farm workers, accountants, agronomists). Adding `farm_id` now costs one column; retrofitting it later requires a full re-migration of production data. The `user_id` column is retained on every table so the personal (no-farm-id) path continues to work for existing data.

### Why nullable `farm_id` instead of a required FK?

Backward-compatibility with migration 001 data. All rows created before migration 002 have `farm_id = NULL`; RLS policies treat null as "personal" and fall back to `user_id` checking. New writes from the application will always supply `farm_id`.

### Why keep text `category` / `sub_category` columns after adding FK columns?

The FK columns (`category_id`, `sub_category_id`, `opex_sub_id`) were added in migration 003 alongside the existing text columns. Dropping the text columns immediately would require a coordinated data backfill migration and an app code change in the same deployment window — high risk. The text columns are deprecated; they will be dropped in a future migration once backfill is complete and the app no longer writes to them.

### Why are categories system rows, not enum types?

PostgreSQL enums require a migration to add new values and cannot be modified easily. Storing categories as table rows means the list can be extended per-farm at runtime, translated into any language, and eventually made user-manageable — without a schema migration.

### Why OPEX keyword arrays instead of regex?

Regex is stored as text in PostgreSQL and cannot be indexed. Keyword arrays allow GIN indexing for fast text-search matching server-side, are easier to extend without code changes, and can be passed directly to a future ML classifier as training features.

### Auto-creation of personal farm on registration

The `handle_new_user` trigger (rewritten in migration 002) creates a farm + owner membership atomically when a new Supabase Auth user is created. This means the app always has a `farm_id` available immediately after sign-up — no extra API call or setup screen needed.
