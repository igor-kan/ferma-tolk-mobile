# Secrets Management & Environment Configuration

**Project:** Ferma.Tolk  
**Ticket:** FT-013  
**Last updated:** 2026-04-05

---

## Quick Reference: All Environment Variables

| Variable                    | Classification               | Required          | Used by              | Notes                                                                                   |
| --------------------------- | ---------------------------- | ----------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Browser / public             | Yes               | `src/lib/config.js`  | Supabase project URL. Safe in bundle.                                                   |
| `VITE_SUPABASE_ANON_KEY`    | Browser / public             | Yes               | `src/lib/config.js`  | Supabase anon key. Safe in bundle. RLS is the access gate.                              |
| `SUPABASE_URL`              | Server / secret              | Yes               | `api/_config.js`     | Same value as `VITE_SUPABASE_URL` but set as a plain Vercel env var for Edge Functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / **critical secret** | Yes               | `api/_config.js`     | Bypasses RLS. Treat like a root password. Rotate on any suspected exposure.             |
| `SUPABASE_DB_URL`           | Server / secret              | For migrations    | CLI / admin scripts  | PostgreSQL connection URI with SSL. Not used at runtime by the app.                     |
| `DEEPGRAM_API_KEY`          | Server / secret              | Yes (voice input) | `api/_config.js`     | Deepgram STT key. Never bundled. Rotate if voice endpoint is abused.                    |
| `APP_ORIGIN`                | Server / config              | No                | `api/speech.js` CORS | Production domain e.g. `https://ferma.tolk.app`. Defaults to allow `*.vercel.app`.      |
| `VITE_APP_ENV`              | Browser / config             | No                | `src/lib/config.js`  | `local \| development \| staging \| production`. Controls fail-fast behaviour.          |
| `RATE_IP_MAX`               | Server / config              | No                | `api/_config.js`     | Max requests per IP per minute. Default: 30.                                            |
| `RATE_USER_MAX`             | Server / config              | No                | `api/_config.js`     | Max requests per user per minute. Default: 10.                                          |
| `RATE_BURST_MAX`            | Server / config              | No                | `api/_config.js`     | Max requests per user per 3 seconds. Default: 5.                                        |
| `RATE_DAILY_MAX`            | Server / config              | No                | `api/_config.js`     | Max requests per user per day. Default: 200.                                            |

---

## Why Two Supabase URL Variables?

```
VITE_SUPABASE_URL   →  Vite injects into browser bundle at BUILD TIME
SUPABASE_URL        →  Vercel Edge Functions read from process.env at REQUEST TIME
```

Vite's `import.meta.env.VITE_*` substitutions happen during `npm run build` — the values are embedded in the JavaScript bundle as string literals. Vercel Edge Functions run in a separate V8 context and use `process.env` at request time; they never see Vite's build-time substitutions.

**Both must be set in Vercel → Settings → Environment Variables**, pointing to the same Supabase project URL.

---

## Secret Classification

| Level        | Variables                              | Exposure consequence                                                                       |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Critical** | `SUPABASE_SERVICE_ROLE_KEY`            | Full database access bypassing all RLS; can read/write/delete any row in any table         |
| **High**     | `DEEPGRAM_API_KEY`                     | Unauthorised billing charges on your Deepgram account                                      |
| **High**     | `SUPABASE_DB_URL`                      | Direct database connection with PostgreSQL credentials                                     |
| **Medium**   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`    | These are intentionally public. Exposure alone causes no harm — RLS and auth protect data. |
| **Low**      | `VITE_APP_ENV`, `APP_ORIGIN`, `RATE_*` | No sensitive value. Misconfiguration may affect behaviour but not security.                |

---

## Fail-Fast Behaviour

### Browser (src/lib/config.js)

| Environment                         | Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `production`                        | Throws `Error` → caught by `ErrorBoundary` → shows configuration error screen |
| `local` / `development` / `staging` | `console.warn` → app loads, Supabase calls fail gracefully                    |

### Server (api/\_config.js)

| Missing variable                              | Behaviour                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` | `assertServerEnv('auth')` returns HTTP 500; logs `[config] MISSING_ENV_VARS` JSON   |
| `DEEPGRAM_API_KEY`                            | `assertServerEnv('speech')` returns HTTP 500; logs `[config] MISSING_ENV_VARS` JSON |

All failures emit structured JSON to `console.error`:

```json
{
  "t": "MISSING_ENV_VARS",
  "missing": ["SUPABASE_URL"],
  "scope": "auth",
  "hint": "See docs/SECRETS-MANAGEMENT.md"
}
```

---

## Setting Variables in Vercel

1. Go to **Vercel Dashboard → your project → Settings → Environment Variables**
2. For each variable, set the correct **Scope** (Production / Preview / Development)
3. Server-side variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEPGRAM_API_KEY`, `SUPABASE_DB_URL`, `APP_ORIGIN`, `RATE_*`) should be set for all scopes
4. **Never** share production credentials with Preview or Development scopes

### Recommended scope configuration

| Variable                    | Production               | Preview (staging)                | Development     |
| --------------------------- | ------------------------ | -------------------------------- | --------------- |
| `VITE_SUPABASE_URL`         | prod project URL         | staging project URL              | dev project URL |
| `VITE_SUPABASE_ANON_KEY`    | prod anon key            | staging anon key                 | dev anon key    |
| `SUPABASE_URL`              | prod project URL         | staging project URL              | dev project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service key         | staging service key              | dev service key |
| `DEEPGRAM_API_KEY`          | prod key                 | staging key (or same)            | dev key         |
| `VITE_APP_ENV`              | `production`             | `staging`                        | `development`   |
| `APP_ORIGIN`                | `https://ferma.tolk.app` | `https://staging.ferma.tolk.app` | _(empty)_       |

---

## Local Development Setup

```bash
# 1. Copy the template
cp .env.example .env.local

# 2. Start the Supabase local stack
supabase start
# → outputs: API URL, anon key, service_role key

# 3. Fill .env.local with the values from supabase start:
#    VITE_SUPABASE_URL=http://localhost:54321
#    VITE_SUPABASE_ANON_KEY=<anon key from output>
#    SUPABASE_URL=http://localhost:54321
#    SUPABASE_SERVICE_ROLE_KEY=<service_role key from output>

# 4. Get a Deepgram key (free tier available):
#    https://console.deepgram.com → API Keys → Create a key

# 5. Run the app
npm run dev
```

---

## Secret Rotation Procedures

### Rotating `SUPABASE_SERVICE_ROLE_KEY`

**Trigger:** Suspected exposure (committed to git, found in logs, third-party breach).

```
1. Go to Supabase Dashboard → Settings → API → service_role key → Reveal → Reset
2. Note the new key immediately (it is shown once after reset)
3. Update ALL environments in Vercel:
   Vercel → Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY
   (update Production, Preview, and Development scopes separately)
4. Trigger a redeployment: Vercel → Deployments → Redeploy
5. Verify: make a request to /api/auth-session — should return 200
6. Verify: old key is rejected — try the old key in a curl request, expect 500
7. Update the local .env.local file on every developer machine
8. Document the rotation date here: _________ Rotated by: _________
```

### Rotating `DEEPGRAM_API_KEY`

**Trigger:** Unexpected billing charges, key found in logs or source control.

```
1. Go to https://console.deepgram.com → API Keys
2. Create a new key with scope: usage:write
3. Update DEEPGRAM_API_KEY in Vercel → Settings → Environment Variables
4. Redeploy on Vercel
5. Delete the old key in Deepgram console
6. Verify voice input works after redeployment
7. Document: _________ Rotated by: _________
```

### Rotating `SUPABASE_DB_URL` (database password)

**Trigger:** Direct database access credential suspected compromised.

```
1. Go to Supabase Dashboard → Settings → Database → Reset database password
2. Update SUPABASE_DB_URL in Vercel with the new password
3. Run supabase link --project-ref <ref> again locally with the new password
4. Verify migrations still work: supabase db push
5. Document: _________ Rotated by: _________
```

### If a secret is committed to git

**This is a critical incident. Follow immediately:**

```
1. Treat the secret as fully compromised — rotate it NOW (steps above)
2. Remove the secret from git history:
   git filter-repo --path-glob '*.env*' --invert-paths
   OR use BFG Repo Cleaner: bfg --delete-files .env
3. Force-push the cleaned history: git push --force-with-lease
4. Notify all developers to re-clone or run: git fetch --all && git reset --hard origin/main
5. File a security incident report
6. Check Vercel/Supabase/Deepgram audit logs for unauthorized access
```

---

## Verifying No Secrets Are in the Bundle

After every build, confirm server-side secret names are absent from the browser bundle:

```bash
npm run build
strings dist/assets/*.js | grep -E "DEEPGRAM|service_role|SUPABASE_SERVICE"
# Expected output: (no output = clean)
```

The following strings are expected in the bundle (they are variable names in validation messages, not values):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (only as a string in warning messages, never as a value)

---

## Rotation Log

| Secret                      | Last Rotated | Rotated By | Reason        |
| --------------------------- | ------------ | ---------- | ------------- |
| `SUPABASE_SERVICE_ROLE_KEY` |              |            | Initial setup |
| `DEEPGRAM_API_KEY`          |              |            | Initial setup |
| `SUPABASE_DB_URL`           |              |            | Initial setup |

---

_Last updated: 2026-04-05 | Ticket: FT-013_
