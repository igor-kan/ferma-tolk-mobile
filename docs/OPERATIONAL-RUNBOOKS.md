# Operational Runbooks & Ownership (FT-037)

This document outlines the procedures for handling common incidents and defines ownership for key system areas.

## 1. System Ownership

| Area | Primary Owner | Responsibilities |
|------|---------------|------------------|
| **Security** | Security Lead | Auth logic, RLS policies, API protection, Secret management. |
| **Database** | DB Admin | Migrations, performance tuning, archival, backup/restore. |
| **Release Ops**| DevOps Engineer| CI/CD pipeline, Vercel config, staging/prod deployments. |
| **Product**  | Product Manager| Feature prioritization, business logic validation. |

## 2. Incident Runbooks

### RB-01: Auth Incidents (Anomalies/Failures)
**Symptoms:** Spike in `AUTH_FAILURE` logs, users unable to login.
1.  **Check Logs:** Use log aggregator to filter by `t: "AUTH_FAILURE"`. Look for specific `reason`.
2.  **Verify Supabase Auth:** Check Supabase Dashboard -> Authentication -> Settings to ensure no provider outages.
3.  **Credential Check:** If `INVALID_TOKEN` spikes, verify if `SUPABASE_SERVICE_ROLE_KEY` was rotated but not updated in Vercel.
4.  **Mitigation:** Rotate keys if compromised; Rollback Vercel if a recent auth-code change was deployed.

### RB-02: Failed Database Migrations
**Symptoms:** CI fails at `validate:migrations`, or production API throws 500s after `db push`.
1.  **Identify Failure:** Look at `scripts/validate-migrations.js` output in CI.
2.  **Sequence Fix:** If a gap exists, rename the offending file to the next available number.
3.  **Manual Revert:** If production is broken, manually `DROP` the offending schema objects via Supabase SQL Editor.
4.  **Data Recovery:** If data was lost, trigger Point-in-Time Recovery (PITR) to the timestamp before the migration.

### RB-03: Speech API Abuse / Quota Exhaustion
**Symptoms:** `RATE_LIMIT_DAILY` logs, Deepgram returns 429/402, or costs spike.
1.  **Analyze Traffic:** Check `[sec]` logs for the IP hash or UID responsible for the spike.
2.  **Tighten Limits:** Lower `RATE_DAILY_MAX` in Vercel environment variables to throttle overall usage.
3.  **Block User:** If abuse is targeted, add a manual block at the Edge or via a database `blocked_users` list (if implemented).
4.  **API Key Rotation:** If the Deepgram key is leaked, rotate it immediately in Deepgram and Vercel.

### RB-04: Full Database Restore
**Symptoms:** Total data corruption or accidental table drop.
1.  **Stop Writes:** If possible, set the application to "Maintenance Mode" (e.g., via a Vercel feature flag or simple Edge Function return).
2.  **PITR Trigger:** Go to Supabase -> Database -> Backups. Select "Point-in-Time Recovery".
3.  **Verify New Instance:** Restore to a temporary project first to confirm data is correct.
4.  **Cutover:** Update `VITE_SUPABASE_URL` and `SUPABASE_URL` in Vercel to point to the restored project.

### RB-05: Release Rollback
**Symptoms:** Breaking UI bug or regression discovered after deploy.
1.  **Frontend:** Open Vercel -> Deployments -> [Last Stable] -> Click "Rollback".
2.  **API:** Since API is bundled with Frontend on Vercel, the rollback covers Edge Functions as well.
3.  **Notify Team:** Post in the escalation channel that a rollback has occurred.

## 3. Escalation Path
1.  **Level 1 (Developer):** Initial alert response and investigation.
2.  **Level 2 (Area Owner):** If mitigation requires destructive DB action or key rotation.
3.  **Level 3 (Engineering Lead):** If the incident affects 100% of users for >15 minutes.
