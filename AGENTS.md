# AGENTS

## Objective

Maintain and evolve `ferma-tolk-mobile` as the mobile distribution repository for Ferma.Tolk.

## Roles

- Project Owner: approves release scope and store distribution.
- Implementation Agent: applies code/runtime changes and updates docs.
- QA Agent: validates Android/iOS behavior and regression coverage.

## Working Rules

- Keep business logic aligned with upstream `ferma.tolk` unless mobile-specific behavior is required.
- Prefer additive, forward-only changes with clear rollback paths.
- Keep `README.md`, `RESEARCH.md`, `PLANNING.md`, and `TASKS.md` updated after architectural changes.
- Do not commit secrets (`.env*` with credentials).

## Definition of Done

- Web build passes.
- Capacitor sync works.
- Android debug APK build succeeds (`npm run mobile:android:debug:apk`).
- Android signed release build succeeds (`npm run mobile:android:release`) when signing inputs exist.
- iOS dependencies resolve (`cd ios/App && pod install`).
- Android/iOS projects remain generation-compatible.
- Documentation reflects current architecture and commands.

<!-- REPO_DOCS_REFRESH_START -->
# AGENTS

This file contains repository-specific working guidance for coding agents collaborating on **ferma-tolk-mobile**.

## Project Snapshot
- Repository: `ferma-tolk-mobile`
- Path: `/home/igorkan/repos/ferma-tolk-mobile`
- Purpose: Mobile-first repository for Ferma.Tolk using a **Capacitor + React + Supabase** architecture.
- Primary Stack: Node.js, React, Vite, JavaScript

## External Research Signals
- Origin Remote: `https://github.com/igor-kan/ferma-tolk-mobile.git`
- GitHub Slug: `igor-kan/ferma-tolk-mobile`
- GitHub Description: Not available
- GitHub Homepage: Not set
- GitHub Topics: None detected
- GitHub Last Push Timestamp: 2026-04-21T17:39:05Z

## Local Commands
Setup:
- `npm ci`

Run:
- `npm run dev`
- `npm run start`

Quality Checks:
- `npm run test`
- `npm run lint`
- `npm run build`

## Agent Workflow
- Make changes that stay scoped to this repository.
- Prefer small, verifiable increments over large speculative rewrites.
- Update docs and task files in this repository when behavior or interfaces change.
- Avoid destructive git operations unless explicitly requested.

## Definition Of Done
- Relevant commands/tests complete successfully for this repository.
- Documentation reflects implemented behavior.
- Remaining risks and follow-ups are captured in `TASKS.md` and `RESEARCH.md`.
<!-- REPO_DOCS_REFRESH_END -->
