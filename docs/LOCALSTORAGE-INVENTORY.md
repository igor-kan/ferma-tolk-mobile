# localStorage Inventory & Migration Map

**Purpose:** Complete audit of every browser storage read and write in the codebase.
This document is the migration map for secure server-side persistence.

Reference: [SECURITY-BASELINE.md](../SECURITY-BASELINE.md) | Ticket: FT-002

---

## Risk Level Legend

| Label      | Meaning                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `CRITICAL` | Credentials or authentication secrets — must never reach the client in production    |
| `HIGH`     | PII (personally identifiable information) or data that could enable account takeover |
| `MEDIUM`   | Business data with financial value — loss or exposure causes material harm           |
| `LOW`      | UI/UX state — no sensitive content, acceptable for client-side storage with caveats  |

---

## Key Inventory

### 1. `agri_users`

| Property        | Value                                                     |
| --------------- | --------------------------------------------------------- |
| **Key pattern** | `agri_users` (global, not namespaced)                     |
| **Owner**       | `src/context/AuthContext.jsx`                             |
| **Operations**  | `getItem` on init · `setItem` on every users state change |
| **Risk level**  | `CRITICAL`                                                |

**Stored shape:**

```json
[
  {
    "id": "1712345678901",
    "email": "user@example.com",
    "password": "plaintext_password",
    "secretAnswer": "plaintext_secret_answer",
    "securityHint": "Имя кота"
  }
]
```

**Sensitive fields:**

| Field          | Risk       | Notes                                                                                |
| -------------- | ---------- | ------------------------------------------------------------------------------------ |
| `email`        | `HIGH`     | PII; enables account enumeration                                                     |
| `password`     | `CRITICAL` | Plaintext. Stored verbatim — readable by any JS on the page, browser extensions, XSS |
| `secretAnswer` | `CRITICAL` | Plaintext. Full password-reset bypass credential                                     |
| `securityHint` | `LOW`      | May indirectly reveal personal context                                               |
| `id`           | `LOW`      | Timestamp-based `Date.now()` — predictable, but not sensitive in isolation           |

**Additional risk:** `Auth.jsx:138` calls `setPassword(u.password)` — the plaintext password is auto-filled into a visible form field from this store on "recent account" click.

**Target DB table:** `users`

```
users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt/argon2, never stored client-side
  security_hint TEXT,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
-- secret_answer: replace entire mechanism with server-side OTP/magic-link reset
```

---

### 2. `agri_current_user`

| Property        | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Key pattern** | `agri_current_user` (global, not namespaced)                             |
| **Owner**       | `src/context/AuthContext.jsx`                                            |
| **Operations**  | `getItem` on init · `setItem` on login/register · `removeItem` on logout |
| **Risk level**  | `CRITICAL`                                                               |

**Stored shape:**

```json
{
  "id": "1712345678901",
  "email": "user@example.com",
  "password": "plaintext_password",
  "secretAnswer": "plaintext_secret_answer",
  "securityHint": "Имя кота"
}
```

**Notes:** This is a full copy of the user object from `agri_users`, including the plaintext password and secret answer. It persists across sessions (browser restart). There is no expiry, no signature, and no server verification — possession of this key grants full app access.

**Target replacement:** A short-lived, HttpOnly session cookie or JWT with a server-verified expiry. The client should receive only a non-sensitive session token; the user object returned to the client must never include password or secretAnswer fields.

---

### 3. `agri_transactions_{userId}`

| Property        | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| **Key pattern** | `agri_transactions_{userId}` (per-user namespaced)             |
| **Owner**       | `src/context/AppContext.jsx`                                   |
| **Operations**  | `getItem` on init · `setItem` on add/update/delete/sync effect |
| **Risk level**  | `MEDIUM`                                                       |

**Stored shape (array of):**

```json
{
  "id": 1712345678901,
  "type": "expense",
  "category": "opex",
  "subCategory": "fuel",
  "projectId": "onion",
  "amount": 1200,
  "liters": 20,
  "fuelType": "diesel",
  "description": "Tractor refueling",
  "date": "2026-04-05T10:00:00.000Z",
  "isFuel": true
}
```

**Sensitive fields:**

| Field                       | Risk     | Notes                                                            |
| --------------------------- | -------- | ---------------------------------------------------------------- |
| `amount`                    | `MEDIUM` | Financial data; reveals farm revenue/cost structure              |
| `description`               | `MEDIUM` | Free text — may contain PII (names, locations, supplier details) |
| `date`                      | `LOW`    | Operational timestamp                                            |
| `type/category/subCategory` | `LOW`    | Classification metadata                                          |
| `projectId`                 | `LOW`    | Internal reference                                               |
| `liters/fuelType/isFuel`    | `LOW`    | Operational data                                                 |

**Target DB table:** `transactions`

```
transactions (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  category    TEXT NOT NULL,
  sub_category TEXT,
  project_id  UUID REFERENCES projects(id),
  amount      NUMERIC(12,2) NOT NULL,
  liters      NUMERIC(8,2),
  fuel_type   TEXT,
  is_fuel     BOOLEAN DEFAULT FALSE,
  description TEXT,
  date        TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
)
```

---

### 4. `agri_transactions` _(legacy / global)_

| Property        | Value                                                   |
| --------------- | ------------------------------------------------------- |
| **Key pattern** | `agri_transactions` (global, no user namespace)         |
| **Owner**       | `src/context/AppContext.jsx` (read-only migration path) |
| **Operations**  | `getItem` on init only (one-time migration read)        |
| **Risk level**  | `MEDIUM`                                                |

**Notes:** Legacy key from a pre-namespacing version of the app. Still read on startup to migrate orphaned transactions into the user-namespaced key. The global key is never written to in current code; it is never deleted after migration (see `AppContext.jsx:31-33`). Any user who used the app before namespacing was introduced has their financial data in an unnamespaced key readable by all users on the same browser profile.

**Target:** Delete this key after migration to the database. No DB table needed — records fold into `transactions`.

---

### 5. `agri_projects_{userId}`

| Property        | Value                                          |
| --------------- | ---------------------------------------------- |
| **Key pattern** | `agri_projects_{userId}` (per-user namespaced) |
| **Owner**       | `src/context/AppContext.jsx`                   |
| **Operations**  | `getItem` on init · `setItem` on `addProject`  |
| **Risk level**  | `MEDIUM`                                       |

**Stored shape (array of):**

```json
[
  { "id": "onion", "name": "onion", "label": "Onion Field" },
  { "id": "watermelon", "name": "watermelon", "label": "Watermelon Field" }
]
```

**Sensitive fields:**

| Field     | Risk     | Notes                                                    |
| --------- | -------- | -------------------------------------------------------- |
| `label`   | `MEDIUM` | Business data; reveals farm structure and crop portfolio |
| `id/name` | `LOW`    | Internal identifiers                                     |

**Target DB table:** `projects`

```
projects (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

---

### 6. `agri_desc_mappings_{userId}`

| Property        | Value                                               |
| --------------- | --------------------------------------------------- |
| **Key pattern** | `agri_desc_mappings_{userId}` (per-user namespaced) |
| **Owner**       | `src/context/AppContext.jsx`                        |
| **Operations**  | `getItem` on init · `setItem` on `setMapping`       |
| **Risk level**  | `MEDIUM`                                            |

**Stored shape:**

```json
{
  "tractor refueling": "fuel",
  "wheat sale": "operationalRevenue"
}
```

**Notes:** Maps lowercased free-text transaction descriptions to OPEX sub-category IDs. Descriptions may contain PII or sensitive supplier/employee names entered by the user.

**Sensitive fields:**

| Field                 | Risk     | Notes                                                  |
| --------------------- | -------- | ------------------------------------------------------ |
| Keys (descriptions)   | `MEDIUM` | Derived from transaction descriptions; may contain PII |
| Values (category IDs) | `LOW`    | Internal classification identifiers                    |

**Target DB table:** `description_mappings`

```
description_mappings (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  description_key TEXT NOT NULL,
  sub_category_id TEXT NOT NULL,
  UNIQUE (user_id, description_key)
)
```

---

### 7. `agri_forecast_adjustments_{userId}`

| Property        | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| **Key pattern** | `agri_forecast_adjustments_{userId}` (per-user namespaced) |
| **Owner**       | `src/context/AppContext.jsx`                               |
| **Operations**  | `getItem` on init · `setItem` on `adjustForecast`          |
| **Risk level**  | `MEDIUM`                                                   |

**Stored shape:**

```json
{
  "2026-3": {
    "fuel": 500,
    "salary": -200
  }
}
```

**Sensitive fields:**

| Field             | Risk     | Notes                                                    |
| ----------------- | -------- | -------------------------------------------------------- |
| Adjustment values | `MEDIUM` | Reveals planned budget figures and financial projections |
| Keys (year-month) | `LOW`    | Date metadata                                            |

**Target DB table:** `forecast_adjustments`

```
forecast_adjustments (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  year        SMALLINT NOT NULL,
  month       SMALLINT NOT NULL,
  category_id TEXT NOT NULL,
  delta       NUMERIC(12,2) NOT NULL,
  UNIQUE (user_id, year, month, category_id)
)
```

---

### 8. `agri_chat_history_{userId}`

| Property        | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| **Key pattern** | `agri_chat_history_{userId}` (per-user namespaced)                |
| **Owner**       | `src/context/AppContext.jsx`                                      |
| **Operations**  | `getItem` on init · `setItem` on `addChatMessage` and `clearChat` |
| **Risk level**  | `MEDIUM`                                                          |

**Stored shape (array of):**

```json
[
  { "id": 1712345678901, "type": "bot", "text": "Привет! Я ваш финансовый ассистент." },
  { "id": 1712345678902, "type": "user", "text": "Потратил 5000 на солярку вчера" }
]
```

**Sensitive fields:**

| Field                  | Risk     | Notes                                                                                   |
| ---------------------- | -------- | --------------------------------------------------------------------------------------- |
| `text` (user messages) | `MEDIUM` | Contains raw voice-transcribed financial entries; may include names, amounts, locations |
| `text` (bot messages)  | `LOW`    | Generated responses; references computed totals from transactions                       |
| `id`                   | `LOW`    | Timestamp-based identifier                                                              |
| `type`                 | `LOW`    | `bot` or `user` — no sensitive content                                                  |

**Target DB table:** `chat_messages`

```
chat_messages (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','bot')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

---

### 9. `agri_selected_month_{userId}`

| Property        | Value                                                |
| --------------- | ---------------------------------------------------- |
| **Key pattern** | `agri_selected_month_{userId}` (per-user namespaced) |
| **Owner**       | `src/context/AppContext.jsx`                         |
| **Operations**  | `getItem` on init · `setItem` on month change effect |
| **Risk level**  | `LOW`                                                |

**Stored shape:** Integer string, e.g. `"3"` (zero-indexed month)

**Notes:** Pure UI state — persists the selected dashboard filter. Not sensitive; acceptable to keep in localStorage post-migration as a UI preference.

**Target:** User preference column or keep in localStorage (`ui_prefs_{userId}`).

---

### 10. `agri_selected_year_{userId}`

| Property        | Value                                               |
| --------------- | --------------------------------------------------- |
| **Key pattern** | `agri_selected_year_{userId}` (per-user namespaced) |
| **Owner**       | `src/context/AppContext.jsx`                        |
| **Operations**  | `getItem` on init · `setItem` on year change effect |
| **Risk level**  | `LOW`                                               |

**Stored shape:** Integer string, e.g. `"2026"`

**Notes:** Same as `agri_selected_month_{userId}` — pure UI state, acceptable in localStorage post-migration.

**Target:** User preference column or keep in localStorage.

---

### 11. `agri_id_history`

| Property        | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Key pattern** | `agri_id_history` (global, not namespaced)                                                      |
| **Owner**       | `src/pages/Auth.jsx`                                                                            |
| **Operations**  | `getItem` + `setItem` on every login/register form submit · `getItem` for datalist autocomplete |
| **Risk level**  | `HIGH`                                                                                          |

**Stored shape:**

```json
["alice@example.com", "bob@example.com"]
```

**Notes:** Accumulates all email addresses ever typed into the login form on this device, including emails for accounts that do not exist or failed login attempts. This list is also exposed as a `<datalist>` in the login form — any JavaScript on the page can read all historical email addresses, which is an account enumeration risk.

**Target:** Remove entirely post-migration. Email autocomplete should come from a server-side "remember me" cookie or browser's built-in credential manager, not a plaintext email list in localStorage.

---

## Summary Table

| #   | Key Pattern                       | Owner File        | Risk       | Migration Target              | Keep Post-Migration?        |
| --- | --------------------------------- | ----------------- | ---------- | ----------------------------- | --------------------------- |
| 1   | `agri_users`                      | `AuthContext.jsx` | `CRITICAL` | `users` table                 | No — eliminate              |
| 2   | `agri_current_user`               | `AuthContext.jsx` | `CRITICAL` | HttpOnly session cookie / JWT | No — eliminate              |
| 3   | `agri_transactions_{uid}`         | `AppContext.jsx`  | `MEDIUM`   | `transactions` table          | No — DB only                |
| 4   | `agri_transactions` (legacy)      | `AppContext.jsx`  | `MEDIUM`   | Fold into `transactions`      | No — delete after migration |
| 5   | `agri_projects_{uid}`             | `AppContext.jsx`  | `MEDIUM`   | `projects` table              | No — DB only                |
| 6   | `agri_desc_mappings_{uid}`        | `AppContext.jsx`  | `MEDIUM`   | `description_mappings` table  | No — DB only                |
| 7   | `agri_forecast_adjustments_{uid}` | `AppContext.jsx`  | `MEDIUM`   | `forecast_adjustments` table  | No — DB only                |
| 8   | `agri_chat_history_{uid}`         | `AppContext.jsx`  | `MEDIUM`   | `chat_messages` table         | No — DB only                |
| 9   | `agri_selected_month_{uid}`       | `AppContext.jsx`  | `LOW`      | UI preference                 | Yes — acceptable            |
| 10  | `agri_selected_year_{uid}`        | `AppContext.jsx`  | `LOW`      | UI preference                 | Yes — acceptable            |
| 11  | `agri_id_history`                 | `Auth.jsx`        | `HIGH`     | Remove entirely               | No — eliminate              |

**Total keys: 11** (2 CRITICAL · 1 HIGH · 6 MEDIUM · 2 LOW)

---

## Additional Observations

### No other client-side storage in use

A full codebase scan (`localStorage`, `sessionStorage`, `indexedDB`, `cookie`) confirms no sessionStorage, IndexedDB, or cookie usage anywhere in the application. All client-side persistence is exclusively via `localStorage`.

### Namespace collision risk

All per-user keys use `Date.now().toString()` as the user ID (e.g., `agri_transactions_1712345678901`). On a shared device, a new user registering within the same millisecond as an existing user would overwrite that user's data. In production, UUIDs must be used.

### No key cleanup on account deletion

There is no account deletion flow. If a user were deleted from `agri_users`, all their per-user namespaced keys (`agri_transactions_{uid}`, etc.) would remain in localStorage indefinitely with no mechanism for cleanup.

### `agri_transactions` legacy key is never deleted

`AppContext.jsx:22-33` migrates data from the legacy global key but never removes it after migration. This means old financial data persists in an unnamespaced key in the browser indefinitely.

---

## Migration Priority Order

Based on risk level and inter-dependency:

1. **BLOCKER-01/02**: `agri_users` + `agri_current_user` — replace with server auth (highest risk)
2. **BLOCKER-01/05**: Remove `agri_id_history` — active account enumeration risk
3. **BLOCKER-03**: `agri_transactions_{uid}` — primary business data, highest migration complexity
4. **BLOCKER-03**: `agri_projects_{uid}` — foreign key dependency for transactions
5. **BLOCKER-03**: `agri_desc_mappings_{uid}` + `agri_forecast_adjustments_{uid}` — dependent on transactions
6. **BLOCKER-03**: `agri_chat_history_{uid}` — lowest migration dependency, can be last
7. Post-migration cleanup: delete `agri_transactions` legacy key from all client stores

---

_Last updated: 2026-04-05 | Ticket: FT-002_
