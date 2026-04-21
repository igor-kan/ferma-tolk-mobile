# Ferma.Tolk — External Integrations Guide

Step-by-step setup for every external service Ferma.Tolk depends on. This guide complements the existing [DATABASE-SETUP.md](./DATABASE-SETUP.md), [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md), and [DEPLOYMENT-PIPELINE.md](./DEPLOYMENT-PIPELINE.md). For Russia-specific availability and alternatives see [RUSSIA-DEPLOYMENT.md](./RUSSIA-DEPLOYMENT.md).

## Service inventory

| Service | Purpose | Required? | Russian alternative |
|---|---|---|---|
| **Supabase** | Postgres + Auth + Realtime | yes | Self-hosted Supabase on Yandex/Selectel |
| **Deepgram** | Speech-to-text (voice input) | yes (for voice) | Yandex SpeechKit, SaluteSpeech, VK Cloud Voice |
| **Vercel** | Hosting + Edge Functions | yes | Yandex Cloud Functions + Object Storage; self-hosted Node + Caddy |
| **GitHub Actions** | CI/CD | optional | GitLab CI, self-hosted Forgejo Actions |

---

## 1. Supabase

**Purpose:** Stores all application data (users, transactions, projects, chat messages), provides authentication via GoTrue, and powers real-time subscriptions for live UI updates.

**Cost:** Free tier covers up to 500 MB database, 1 GB file storage, 50K monthly active users — sufficient for most farm-scale deployments.

### 1.1 Create the Supabase project

1. Sign up at https://supabase.com
2. Click **New project**
3. Pick a project name (e.g. `ferma-tolk-prod`), database password, and region
   - **Region matters for latency.** Choose `eu-central-1` (Frankfurt) for European Russia, or `ap-south-1` (Mumbai) for Siberia/Far East. There is no Russia region — see [RUSSIA-DEPLOYMENT.md § 1](./RUSSIA-DEPLOYMENT.md#1-supabase) for self-hosted alternatives.
4. Wait ~2 minutes for provisioning
5. Note down:
   - **Project URL** (`https://xxx.supabase.co`)
   - **anon public key** (Settings → API)
   - **service_role secret key** (Settings → API — keep secret, server-side only)
   - **DB connection string** (Settings → Database → URI tab)

### 1.2 Apply migrations

Migrations live in `supabase/migrations/` (9 SQL files numbered 001–009). Two ways to apply them:

**Option A — Supabase CLI (recommended for local dev):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

**Option B — Direct psql (works for any Postgres):**
```bash
export DB_URL='postgresql://postgres:PASSWORD@db.your-project-ref.supabase.co:5432/postgres?sslmode=require'
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$DB_URL" -f "$f"
done
```

### 1.3 Configure authentication

In the Supabase dashboard:

1. **Authentication → Providers → Email**
   - Enable Email provider
   - Disable "Confirm email" if you want passwordless onboarding (or keep enabled and configure SMTP)
2. **Authentication → URL Configuration**
   - Site URL: `https://your-domain.ru` (or `http://localhost:5173` for dev)
   - Redirect URLs: same + `/auth/callback`
3. **Authentication → SMTP Settings** (optional but recommended):
   - Use a Russian SMTP provider (Yandex Mail, Mail.ru) — see [RUSSIA-DEPLOYMENT.md § 4](./RUSSIA-DEPLOYMENT.md#4-smtp-providers)

### 1.4 Verify Row-Level Security

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/rls_verification.sql
```

All 9 test cases should pass. If any fail, **do not deploy** — investigate using [RLS-SECURITY-REVIEW.md](./RLS-SECURITY-REVIEW.md).

### 1.5 Wire it into the app

In `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.your-project-ref.supabase.co:5432/postgres?sslmode=require
```

In Vercel: **Project Settings → Environment Variables** — add all four variables for Production, Preview, and Development scopes.

---

## 2. Deepgram (speech-to-text)

**Purpose:** Transcribes voice notes from the chat assistant. Used by `api/speech.js`.

**Cost:** Free tier includes $200 of credit (≈ 750 hours of nova-2 transcription). Pay-as-you-go after that at ~$0.0043/minute.

> ⚠️ **Russia caveat:** Deepgram is a US-based company. As of early 2026 it accepts Russian users but billing requires non-Russian payment methods. End-user API calls from Russian IPs work. **If billing becomes problematic, switch to Yandex SpeechKit** — see [RUSSIA-DEPLOYMENT.md § 3](./RUSSIA-DEPLOYMENT.md#3-speech-to-text).

### 2.1 Create a Deepgram account and API key

1. Sign up at https://console.deepgram.com
2. Verify your email
3. Go to **API Keys → Create a key**
4. Name: `ferma-tolk-prod`
5. Scope: `usage:write` (this is the minimum for transcription)
6. Copy the key — Deepgram only shows it once

### 2.2 Wire it in

In `.env.local` and Vercel env vars:
```bash
DEEPGRAM_API_KEY=your-api-key
```

`api/speech.js` reads `process.env.DEEPGRAM_API_KEY` at request time. Test it locally:

```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:5173/api/speech \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -F "audio=@test.webm"
# Should return 202 Accepted with a jobId
```

### 2.3 Model and language settings

Default model is `nova-2` (multilingual including Russian). To force Russian transcription, the request to Deepgram already passes `language=ru` in `api/speech.js`. To experiment with other models, edit that file.

---

## 3. Vercel (hosting + Edge Functions)

**Purpose:** Hosts the Vite-built SPA and runs Edge Functions in the `api/` directory (auth validation, speech transcription, analytics).

**Cost:** Hobby (free) tier supports unlimited static deployments and 100 GB-hours of Edge Function compute per month — easily enough for a farm-scale deployment.

> ⚠️ **Russia caveat:** Vercel free tier sign-up works from Russian IPs. Paid Pro/Enterprise upgrades require non-Russian payment methods. **If you need to leave Vercel, see [RUSSIA-DEPLOYMENT.md § 2](./RUSSIA-DEPLOYMENT.md#2-vercel--alternatives) for self-hosting on Yandex Cloud, Selectel, or a generic VPS.**

### 3.1 Connect the GitHub repository

1. Sign in to https://vercel.com (use GitHub OAuth)
2. **Add New → Project**
3. Import `igor-kan/ferma.tolk`
4. **Framework preset:** Vite (auto-detected)
5. **Build command:** `npm run build` (default)
6. **Output directory:** `dist` (default)

### 3.2 Add environment variables

In **Project Settings → Environment Variables**, add the variables from `.env.example` for the **Production**, **Preview**, and **Development** environments:

| Variable | Production | Preview | Development |
|---|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | ✓ | ✓ |
| `VITE_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_URL` | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ |
| `DEEPGRAM_API_KEY` | ✓ | ✓ | ✓ |
| `VITE_APP_ENV` | `production` | `staging` | `development` |
| `APP_ORIGIN` | your prod URL | (blank) | (blank) |
| `RATE_IP_MAX` etc. | (optional) | (optional) | (optional) |

### 3.3 Custom domain

1. **Project Settings → Domains → Add**
2. Enter your domain (e.g. `ferma.tolk.ru`)
3. Follow Vercel's DNS instructions — typically a CNAME to `cname.vercel-dns.com`
4. Wait for the SSL certificate to provision (~30 seconds)

### 3.4 Deployment workflow

The repo's `.github/workflows/deployment.yml` runs lint + tests + Playwright on every push, then deploys:
- `staging` branch → Preview deployment
- `main` branch → Production deployment

For details see [DEPLOYMENT-PIPELINE.md](./DEPLOYMENT-PIPELINE.md).

---

## 4. GitHub Actions (CI/CD)

**Purpose:** Validate every PR (lint, unit tests, Playwright e2e) and trigger Vercel deployments.

**Cost:** Free for public repos; 2,000 minutes/month free for private repos.

> ✅ **Russia status:** GitHub Actions remains accessible from Russia. Some Russian users have reported intermittent issues during sanctioned periods but the service has not been blocked.

### 4.1 Required GitHub secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret | Source |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create token |
| `VERCEL_ORG_ID` | `vercel link` then read `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | same |
| `SUPABASE_URL` | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard |
| `DEEPGRAM_API_KEY` | Deepgram console |

### 4.2 Local pre-push validation

```bash
npm run lint
npm test
npm run validate:env
npm run validate:migrations
```

If all four pass locally, the GitHub Actions pipeline should also pass.

---

## 5. Optional: SMTP for Supabase Auth emails

By default, Supabase sends confirmation/password-reset emails through its own (rate-limited) infrastructure. For production it's recommended to bring your own SMTP.

### 5.1 Russia-friendly SMTP options

| Provider | Endpoint | Notes |
|---|---|---|
| **Yandex Mail** | smtp.yandex.ru:465 | Free for personal accounts; app password required |
| **Yandex 360** | smtp.yandex.ru:465 | Custom domain support, paid |
| **Mail.ru** | smtp.mail.ru:465 | Free; app password required |
| **UniSender Go** | smtp.go.unisender.ru | Russian transactional, 1500/mo free |
| **Beget Mail** | smtp.beget.com:465 | Tied to Beget hosting |
| **Self-hosted Postfix** | your-server | Works but deliverability is hard |

### 5.2 Configure in Supabase

1. **Authentication → SMTP Settings** in the Supabase dashboard
2. Fill in:
   - Sender email: `noreply@your-domain.ru`
   - Sender name: `Ferma.Tolk`
   - SMTP Host: `smtp.yandex.ru`
   - SMTP Port: `465`
   - SMTP User: `noreply@your-domain.ru`
   - SMTP Pass: app password (generated at https://id.yandex.ru/security/app-passwords)
3. **Save** and send a test email

---

## 6. Optional: error tracking and analytics

| Tool | Russia status | Self-hostable? | Notes |
|---|---|---|---|
| **Sentry (cloud)** | ❌ Sales suspended in Russia | yes | Use Glitchtip instead |
| **Glitchtip** | ✅ Open source | yes | Sentry-compatible API, MIT licensed, deploy on Yandex Cloud |
| **PostHog (cloud)** | ⚠️ | yes | Self-host on Russian infra |
| **Plausible (cloud)** | ⚠️ Stripe billing | yes | Self-host on Russian infra |
| **Yandex Metrica** | ✅ Native | no (cloud only) | Free, GDPR/Russian-law compliant |
| **Umami** | ✅ Open source | yes | Lightweight, self-hosted |

To add Sentry-compatible error tracking:

```bash
npm install @sentry/react
```

In `src/main.jsx`:
```js
import * as Sentry from '@sentry/react';
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,  // point at Glitchtip
  environment: import.meta.env.VITE_APP_ENV,
});
```

---

## 7. Quick env-var reference

| Env var | Service | Required? | Where to get it |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase (browser) | yes | Supabase dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase (browser) | yes | Supabase dashboard → Settings → API |
| `SUPABASE_URL` | Supabase (server) | yes | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (server) | yes | Supabase dashboard → Settings → API → service_role |
| `SUPABASE_DB_URL` | Migrations | yes | Supabase dashboard → Settings → Database → URI |
| `DEEPGRAM_API_KEY` | Deepgram | yes (voice) | https://console.deepgram.com → API Keys |
| `VITE_APP_ENV` | App | yes | `local` / `development` / `staging` / `production` |
| `APP_ORIGIN` | CORS | optional | Production HTTPS URL |
| `RATE_IP_MAX` etc. | Rate limiting | optional | Defaults are safe |

For secret rotation procedures see [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md).
