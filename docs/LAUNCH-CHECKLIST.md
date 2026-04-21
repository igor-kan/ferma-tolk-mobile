# Production Launch Checklist

**This checklist enforces the go/no-go decision for any production deployment.**

A deployment is GO only when every item below is checked and the sign-off table
at the bottom is completed. An incomplete checklist is an automatic NO-GO.

Reference: [SECURITY-BASELINE.md](../SECURITY-BASELINE.md)

---

## NO-GO: Current Status

> The following critical items are unresolved. Production deployment is **prohibited**.

- Passwords stored in plaintext in `localStorage` (BLOCKER-01)
- No server-side authentication (BLOCKER-02)
- No database — all data lost on browser clear (BLOCKER-03)
- No API authentication or rate limiting (BLOCKER-04)
- Secret answers stored in plaintext client-side (BLOCKER-05)
- No security headers configured (BLOCKER-06)
- No HTTPS enforcement / HSTS (BLOCKER-07)
- No automated test suite (BLOCKER-08)
- No CI/CD pipeline (BLOCKER-09)

---

## Security Requirements

### Authentication & Identity

- [ ] Server-side auth system implemented (sessions or JWTs) <!-- Model: Sonnet 4.6 · Effort: medium -->
- [ ] Passwords hashed with bcrypt or argon2 server-side <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] No credential material stored in `localStorage` or any client-accessible store <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Password reset uses secure out-of-band channel (email OTP or magic link) <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Session expiry and logout invalidate server-side session <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Account enumeration attacks mitigated (consistent error messages) <!-- Model: Haiku 4.5 · Effort: minimal -->

### Data Persistence

- [ ] Production database provisioned with encryption at rest <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] All user data writes go to the database, not `localStorage` <!-- Model: Sonnet 4.6 · Effort: medium -->
- [ ] Automated database backups configured and tested (restore verified) <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Database credentials are environment variables, never committed to source <!-- Model: Haiku 4.5 · Effort: minimal -->

### API Security

- [ ] All API endpoints require authenticated session / valid token <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Rate limiting applied to auth endpoints and all public API routes <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Input validation on all API inputs (type, length, format) <!-- Model: Haiku 4.5 · Effort: low -->
- [ ] API returns generic error messages (no stack traces, no internal paths) <!-- Model: Haiku 4.5 · Effort: minimal -->

### Transport & Headers

- [ ] All traffic served over HTTPS <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] HTTP permanently redirects to HTTPS (301) <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `Strict-Transport-Security` header present (`max-age >= 31536000; includeSubDomains`) <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `Content-Security-Policy` header configured and tested <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN` set <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `X-Content-Type-Options: nosniff` set <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `Referrer-Policy` set <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] securityheaders.com score: A or higher <!-- Model: Sonnet 4.6 · Effort: low -->

### Secrets Management

- [ ] All API keys / secrets are environment variables in hosting platform <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] No secrets committed to source control (verify with `git log --all -S <secret>` pattern) <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] `.env` is in `.gitignore` <!-- Model: Haiku 4.5 · Effort: minimal -->

---

## Quality & Reliability Requirements

### Testing

- [ ] Unit tests cover auth flows <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Unit tests cover transaction CRUD operations <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Integration tests cover API endpoints <!-- Model: Sonnet 4.6 · Effort: medium -->
- [ ] All tests pass in CI <!-- Model: Haiku 4.5 · Effort: minimal -->

### CI/CD

- [ ] CI pipeline runs on every pull request to `main` <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] CI gates: lint, build, test — all must pass before merge <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Production deployments triggered only from CI, never from local machine <!-- Model: Haiku 4.5 · Effort: minimal -->

### Monitoring & Incident Response

- [ ] Error monitoring configured (e.g., Sentry or equivalent) <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Uptime monitoring configured <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] An incident response contact is designated <!-- Model: Haiku 4.5 · Effort: minimal -->

---

## Legal & Compliance Requirements

- [ ] Privacy policy published and linked in the app <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Terms of service published <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Cookie / storage consent mechanism in place if required by applicable law <!-- Model: Sonnet 4.6 · Effort: low -->
- [ ] Data retention and deletion policy defined <!-- Model: Sonnet 4.6 · Effort: low -->

---

## Pre-Launch Security Review

- [ ] Code review completed for all auth and data-handling code <!-- Model: Opus 4.6 · Effort: medium -->
- [ ] Dependency audit run (`npm audit`) with no critical/high vulnerabilities unaddressed <!-- Model: Haiku 4.5 · Effort: minimal -->
- [ ] Penetration test or structured threat model review completed <!-- Model: Opus 4.6 · Effort: high -->
- [ ] Review findings documented and resolved <!-- Model: Sonnet 4.6 · Effort: medium -->

---

## Sign-Off

All of the above must be checked before completing sign-off.

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Engineering Lead |      |      |           |
| Project Owner    |      |      |           |

**Deployment approved for production:** YES / NO

---

_Last updated: 2026-04-05 | Ticket: FT-001_
