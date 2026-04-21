# Release Checklist & Change Management Policy (FT-038)

## 1. Objective
Ensure that every production release is high-quality, traceable, and verified. This policy defines the mandatory steps required to move code from `staging` to `main`.

## 2. Change Classification

| Class | Definition | Review Requirement |
|-------|------------|--------------------|
| **Low Risk** | UI tweaks, bug fixes, internal refactors. | 1 Peer Review |
| **High Risk** | Schema changes, RLS policy shifts, Auth logic, new API endpoints. | 2 Peer Reviews + Security Lead Approval |

## 3. Pre-Release Checklist (Mandatory)

### [ ] CI/CD Status <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `validate:migrations` passed. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `validate:env` passed. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `lint` passed. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `test` (Unit/Integration) passed (128+ tests). <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `e2e` (Playwright) passed. <!-- Model: Haiku 4.5 · Effort: minimal -->

### [ ] Staging Validation <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Code is deployed to `staging` branch. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `smoke-test` passed against the staging URL. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Manual verification of the specific feature/fix on staging. <!-- Model: Haiku 4.5 · Effort: minimal -->

### [ ] Database & Security (if applicable) <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] New migrations follow sequential naming. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] RLS policies have been reviewed for "Alice cannot see Bob's data" integrity. <!-- Model: Opus 4.6 · Effort: low -->
- [ ] Migration rollback script verified (if destructive). <!-- Model: Sonnet 4.6 · Effort: low -->

## 4. Release Execution
1. Merge `staging` into `main`.
2. Monitor GitHub Actions for the `deploy-production` job.
3. Verify that the automatic Git tag (e.g., `v2026.04.07-...`) was created.

## 5. Post-Deploy Verification (Standardized)
- [ ] Run `URL=https://app.ferma-tolk.com npm run smoke-test`. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Monitor Vercel logs for `AUTH_FAILURE` or 5xx spikes for 10 minutes. <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Verify core transaction entry still functions in production. <!-- Model: Haiku 4.5 · Effort: minimal -->

## 6. Rollback Trigger
If any post-deploy verification step fails, trigger **RB-05: Release Rollback** immediately.
