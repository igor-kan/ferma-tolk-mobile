# Ferma.Tolk — Dependency Audit for Russia

This document audits every external dependency and third-party service used by Ferma.Tolk against two criteria:

1. **Available from Russia** — accessible to operators and users physically in Russia, not blocked by the provider's sanctions/export-control policy
2. **Not banned by the Russian government** — not subject to Roskomnadzor blocks or other Russian regulatory restrictions

A dependency must satisfy **both** to be production-safe for a Russian deployment. Last reviewed: **2026-04-08**.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Safe to use — no known issues |
| ⚠️ | Works with caveats — read the notes |
| ❌ | Do not use — banned, restricted, or impractical |
| N/A | Not applicable to this dependency type |

---

## Part 1 — npm runtime dependencies

| Package | Version | License | From-Russia? | Russia-banned? | Notes |
|---|---|---|---|---|---|
| `@supabase/supabase-js` | ^2.101.1 | MIT | ✅ | ✅ N/A | npm-published JS client. The library installs fine. **Whether it works at runtime depends on which Supabase instance you point it at** — see § 3 for cloud-vs-self-host trade-offs. |
| `@tanstack/react-query` | ^5.96.2 | MIT | ✅ | ✅ N/A | Open source, no network calls of its own. |
| `react` | ^19.2.4 | MIT | ✅ | ✅ N/A | Open source. |
| `react-dom` | ^19.2.4 | MIT | ✅ | ✅ N/A | Open source. |
| `lucide-react` | ^1.7.0 | ISC | ✅ | ✅ N/A | Icon set published on npm. |
| `zod` | ^4.3.6 | MIT | ✅ | ✅ N/A | Schema validation library. No network. |

### npm devDependencies

| Package | Version | License | Notes |
|---|---|---|---|
| `vite` | ^7.3.1 | MIT | ✅ Build tool |
| `@vitejs/plugin-react` | ^4.7.0 | MIT | ✅ React HMR plugin |
| `@playwright/test` | ^1.59.1 | Apache-2 | ✅ E2E testing. **Note:** Playwright downloads browser binaries from a Microsoft CDN — see § 5. |
| `eslint` and plugins | ^9.39.4 | MIT | ✅ All open source |
| `prettier` | ^3.8.1 | MIT | ✅ |

---

## Part 2 — Runtime infrastructure

| Component | From-Russia? | Russia-banned? | Notes |
|---|---|---|---|
| **Node.js 20 LTS** | ✅ | ✅ N/A | nodejs.org and Linux package mirrors are accessible |
| **npm registry** | ✅ | ✅ N/A | registry.npmjs.org generally accessible. Mirror via Verdaccio or Yandex npm proxy as backup. |
| **GitHub** (code hosting) | ✅ | ✅ N/A | Roskomnadzor has not blocked GitHub. Some intermittent issues for individual users but not systematic. |
| **GitHub Actions** | ✅ | ✅ N/A | Free tier minutes available. Some Russian users have reported friction during sanctioned periods. |
| **Docker Hub** | ⚠️ | ✅ | Docker Inc. partially restricted Russian access in 2024 then partially reversed. Public image pulls generally work; mirror via Selectel or Yandex Container Registry as backup. |
| **Playwright browser CDN** | ⚠️ | ✅ | Playwright downloads Chromium/Firefox/Webkit binaries from playwright.azureedge.net (Microsoft Azure). Generally works; can be mirrored via `PLAYWRIGHT_BROWSERS_PATH` for offline use. |

---

## Part 3 — External services

### 3.1 Supabase

| Aspect | Status | Notes |
|---|---|---|
| Cloud sign-up | ✅ | Free tier accessible from Russian IPs via GitHub OAuth |
| Cloud free tier API | ✅ | API calls work from Russian IPs |
| Cloud paid tier | ❌ | Stripe billing rejects Russian-issued cards |
| Region selection | ⚠️ | No Russia region; closest is Frankfurt (eu-central-1) or Mumbai (ap-south-1) |
| Self-hosted via Docker | ✅ | Fully open source, deploy on Yandex Cloud/Selectel/any VPS — **recommended for production** |
| Sanctions exposure | ⚠️ | Cloud is hosted on AWS; AWS has restricted some Russian entities. Self-hosting eliminates this risk. |

**Recommendation:** Use Supabase Cloud for development. Self-host on a Russian VPS for production. The app code is identical for both — only the URL/keys change.

### 3.2 Deepgram (speech-to-text)

| Aspect | Status | Notes |
|---|---|---|
| Sign-up | ⚠️ | Works from Russian IPs but credit purchase requires non-Russian card |
| Free tier | ⚠️ | $200 trial credit available but tied to billing setup |
| API calls from Russian IPs | ✅ | Currently functional |
| Russian language support | ✅ | nova-2 model handles Russian well |
| Stability of access | ⚠️ | US company; could change. **Recommend having Yandex SpeechKit adapter ready.** |

**Recommendation:** Use Deepgram for development if you have a non-Russian card. Switch to Yandex SpeechKit for production deployments — see [RUSSIA-DEPLOYMENT.md § 3](./RUSSIA-DEPLOYMENT.md#3-speech-to-text) for the adapter sketch.

### 3.3 Vercel

| Aspect | Status | Notes |
|---|---|---|
| Sign-up | ⚠️ | Free Hobby tier works via GitHub OAuth from Russian IPs |
| Free tier deployments | ✅ | Currently functional |
| Free tier Edge Functions | ✅ | 100 GB-hours/mo |
| Paid Pro tier | ❌ | Billing rejects Russian-issued cards |
| Custom domains | ✅ | Free on Hobby tier |
| Stability | ⚠️ | Vercel TOS reviews have been reported for some Russian customers |

**Recommendation:** Vercel free tier is currently fine. For long-term resilience, plan to self-host on Yandex Cloud Functions or a generic VPS — see [RUSSIA-DEPLOYMENT.md § 2](./RUSSIA-DEPLOYMENT.md#2-vercel--alternatives).

### 3.4 GitHub & GitHub Actions

| Aspect | Status |
|---|---|
| Code hosting | ✅ |
| Pull requests / issues | ✅ |
| Actions free minutes | ✅ |
| Copilot purchase | ❌ (not used by this project) |
| Sponsors (paying out to Russian users) | ❌ (not relevant) |

### 3.5 Optional: Stripe-billed services Ferma.Tolk could consume

These are not currently used but worth noting:

| Service | Status | Russian alternative |
|---|---|---|
| Sentry (error tracking) | ❌ | Glitchtip (self-hosted, MIT) |
| PostHog (product analytics) | ⚠️ | Self-host PostHog or Umami |
| Plausible (web analytics) | ⚠️ | Self-host Plausible or Umami; or Yandex Metrica |
| Stripe (payments) | ❌ | YooKassa, CloudPayments, Tinkoff |
| Twilio (SMS / WhatsApp) | ❌ | SMSC.ru, SMS.ru, Voximplant |
| OpenAI API | ❌ | YandexGPT, GigaChat (Sber), Vikhr (open source) |
| Anthropic Claude API | ❌ | Same as above |

---

## Part 4 — License compatibility

All current dependencies are MIT, ISC, BSD, or Apache-2 licensed. No copyleft (GPL/AGPL) or commercial-license dependencies. This is important for Russian organizations because:

- **GPL/AGPL** would force the entire app to be open-sourced — not a Russia-specific issue but worth noting.
- **Commercial licenses** typically require paying a US/EU vendor — which may be impossible from Russia. Ferma.Tolk has none.

| License | Count | Risk |
|---|---|---|
| MIT | 12 | None |
| Apache-2 | 1 | None (patent grant is favorable) |
| ISC | 1 | None |
| BSD | 0 | — |
| GPL/AGPL | 0 | — |
| Proprietary | 0 | — |

---

## Part 5 — Build-time vs runtime dependencies

A subtlety worth flagging: some dependencies only matter during the **build** (which can run anywhere) and not at **runtime** (which must run for users in Russia). Build-time problems are easier to mitigate.

### Build-time only (need access during `npm run build` / CI)
- npm registry
- GitHub Actions runners
- Playwright browser CDN
- Docker Hub (if building containers)
- TypeScript / ESLint / Prettier compilation

If any of these become inaccessible from Russia, you can:
- Run builds from outside Russia (laptop in EU, VPS in Frankfurt, etc.) and only deploy artifacts to Russia
- Mirror npm to a self-hosted Verdaccio instance
- Mirror Docker images to Yandex Container Registry

### Runtime (need access from production users in Russia)
- Supabase Cloud (or self-hosted)
- Deepgram (or Yandex SpeechKit)
- Vercel (or self-hosted)
- DNS provider
- TLS certificate authority (Let's Encrypt)
- (None of the npm dependencies — they're bundled into the build artifact)

The runtime list is **much shorter and more critical**. The mitigations above address each:

| Runtime dependency | If blocked, switch to |
|---|---|
| Supabase Cloud | Self-hosted Supabase |
| Deepgram | Yandex SpeechKit |
| Vercel | Yandex Cloud Functions / Selectel VPS |
| Cloudflare DNS | Yandex DNS / Beget DNS |
| Let's Encrypt | ZeroSSL / Russian "TLS" CA |

---

## Part 6 — Risks introduced by current dependencies

### High priority

1. **Deepgram payment dependency** — End-user voice input depends on a US service that requires non-Russian payment. Even if the API itself remains accessible, billing problems could break voice input.
   - **Action:** implement Yandex SpeechKit adapter ([RUSSIA-DEPLOYMENT.md § 3](./RUSSIA-DEPLOYMENT.md#3-speech-to-text)) and switch via env var.

2. **Supabase Cloud + AWS hosting** — Production data lives on AWS infrastructure that has restricted Russian access in some scenarios.
   - **Action:** plan a self-hosted Supabase deployment as the production target. Document the migration path (already in [RUSSIA-DEPLOYMENT.md § 1](./RUSSIA-DEPLOYMENT.md#1-supabase)).

### Medium priority

3. **Vercel hosting** — Free tier currently works but TOS reviews have hit some Russian customers. Single point of failure for both static hosting and Edge Functions.
   - **Action:** prepare a Yandex Cloud Functions or VPS-based fallback recipe (already in [RUSSIA-DEPLOYMENT.md § 2](./RUSSIA-DEPLOYMENT.md#2-vercel--alternatives)).

### Low priority

4. **Playwright browser binary download** — Build pipeline depends on Microsoft-hosted CDN. Generally works but could become flaky.
   - **Action:** use `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` and pre-download once.

5. **Docker Hub for base images** — `node:20` and Supabase containers come from Docker Hub.
   - **Action:** mirror to Selectel or Yandex Container Registry; cache images in a private registry.

---

## Part 7 — Recommended actions

| # | Action | Priority | Effort | Status | Model · Effort |
|---|---|---|---|---|---|
| 1 | Document Russia deployment alternatives | High | done | ✅ [RUSSIA-DEPLOYMENT.md](./RUSSIA-DEPLOYMENT.md) | — |
| 2 | Document integrations setup | High | done | ✅ [INTEGRATIONS.md](./INTEGRATIONS.md) | — |
| 3 | Document dependency audit | High | done | ✅ this file | — |
| 4 | Implement Yandex SpeechKit adapter for `api/speech.js` | High | 1 day | pending | Sonnet 4.6 · medium |
| 5 | Test self-hosted Supabase deployment end-to-end | High | 1-2 days | pending | Sonnet 4.6 · medium |
| 6 | Add Glitchtip self-hosted error tracking | Medium | 4 hours | pending | Sonnet 4.6 · low |
| 7 | Mirror Docker base images to a Russian registry | Low | 4 hours | pending | Haiku 4.5 · low |
| 8 | Set up Verdaccio npm mirror | Low | 4 hours | pending | Haiku 4.5 · low |
| 9 | Add CSP headers (already a release blocker — BLOCKER-06) | High | 2 hours | pending | Haiku 4.5 · minimal |
| 10 | Add HSTS / HTTPS redirect (BLOCKER-07) | High | 1 hour | pending | Haiku 4.5 · minimal |

## Part 8 — How to verify availability yourself

Run periodically (or in CI from a Russian VM) to detect when something breaks:

```bash
#!/bin/bash
# verify-russia-access.sh — exit non-zero if any critical service is unreachable

set -e

check() {
  local label="$1"; local url="$2"
  if curl -fsSL --max-time 10 "$url" >/dev/null; then
    echo "✅ $label"
  else
    echo "❌ $label — UNREACHABLE"
    return 1
  fi
}

check "npm registry"          "https://registry.npmjs.org/"
check "GitHub API"            "https://api.github.com/"
check "Docker Hub"            "https://hub.docker.com/v2/"
check "Let's Encrypt ACME"    "https://acme-v02.api.letsencrypt.org/directory"
check "Supabase Cloud"        "https://supabase.com/"
check "Supabase API base"     "https://api.supabase.com/"
check "Deepgram API"          "https://api.deepgram.com/v1/projects"
check "Vercel"                "https://vercel.com/"
check "Vercel API"            "https://api.vercel.com/"
check "Yandex SpeechKit"      "https://stt.api.cloud.yandex.net/"
check "Yandex Cloud"          "https://cloud.yandex.ru/"
check "Selectel"              "https://api.selectel.ru/"
check "Playwright CDN"        "https://playwright.azureedge.net/"
```

If `Supabase API base` or `Deepgram API` start failing, follow the migration plan in [RUSSIA-DEPLOYMENT.md](./RUSSIA-DEPLOYMENT.md).

---

## Part 9 — Cross-references

- [RUSSIA-DEPLOYMENT.md](./RUSSIA-DEPLOYMENT.md) — full deployment guide for Russia
- [INTEGRATIONS.md](./INTEGRATIONS.md) — step-by-step service setup
- [DATABASE-SETUP.md](./DATABASE-SETUP.md) — Supabase provisioning details (cloud-focused)
- [SECRETS-MANAGEMENT.md](./SECRETS-MANAGEMENT.md) — env var rotation
- [DEPLOYMENT-PIPELINE.md](./DEPLOYMENT-PIPELINE.md) — GitHub Actions workflow
- [SECURITY-BASELINE.md](../SECURITY-BASELINE.md) — release blocker tracker
