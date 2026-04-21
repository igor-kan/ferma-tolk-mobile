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
