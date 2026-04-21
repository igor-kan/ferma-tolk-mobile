# Monitoring, Alerting, and Error Tracking Strategy (FT-036)

## 1. Error Tracking & Instrumentation

### Frontend (Client-side)
- **Error Boundary:** The `src/shared/ui/ErrorBoundary.jsx` catches React render-time exceptions and logs them to the console in a structured format (`[crash] { ... }`).
- **Global Handlers:** `window.onerror` and `window.onunhandledrejection` are instrumented in `src/main.jsx` to capture async errors and network failures.
- **Provider Logging:** Critical failures in TanStack Query or Supabase Auth are logged with specific tags (`[query-error]`, `[auth-error]`).

### Backend (Vercel Edge Functions)
- **Security Logging:** All Edge Functions (`api/*.js`) use `api/_security-log.js` to emit structured JSON logs (`[sec] { ... }`).
- **Standard Schema:** Logs include `ts` (timestamp), `t` (event type), `outcome`, `endpoint`, and `reason`.
- **Anonymization:** Client IPs are hashed daily in production to preserve privacy while allowing session correlation.

## 2. Alerts & Monitoring

### Metrics & Dashboards
- **Vercel Analytics:** Used for tracking Edge Function invocation counts, execution times, and 4xx/5xx error rates.
- **Supabase Dashboard:** Used for database performance monitoring, query execution plans, and RLS performance metrics.
- **Log Drains:** Production logs are drained to a centralized log aggregator (e.g., Logtail, Datadog, or BetterStack) for long-term retention and analysis.

### Critical Alerts
Alerts are configured in the log aggregator or Vercel dashboard for the following events:
1.  **High Error Rate:** >5% of requests returning 5xx status codes over a 5-minute window.
2.  **Auth Anomalies:** Multiple `AUTH_FAILURE` events from the same IP hash within 1 minute.
3.  **Deployment Breakage:** Build failures or smoke test failures in the CI/CD pipeline.
4.  **Database Latency:** Average query execution time exceeding 500ms.

## 3. On-Call & Debugging Workflow

### Step 1: Identification
- Received alert via Email/Slack/Telegram.
- Check the log aggregator for the specific `reason` or `stack` trace.

### Step 2: Investigation
- Correlate the `uid` or `ip` hash to see if the issue is isolated to a specific user or device.
- Use `git log` to identify if the issue started after a specific deployment (traceable via Git tags).

### Step 3: Mitigation
- **UI/API Bug:** Perform an "Instant Rollback" in Vercel if necessary.
- **Database/RLS Issue:** Review the migration that introduced the change and apply a fix or PITR restoration.

### Step 4: Resolution
- Apply the permanent fix.
- Verify resolution via the Staging environment smoke tests.
- Close the alert and document the incident if major.
