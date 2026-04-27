# Tasks

## Completed

- [x] Analyze source repository architecture (`ferma.tolk`).
- [x] Research mobile delivery options and choose best fit.
- [x] Create new repository at `/home/igorkan/repos/ferma-tolk-mobile`.
- [x] Integrate Capacitor dependencies and scripts.
- [x] Add `capacitor.config.json`.
- [x] Add native runtime bootstrap (`src/mobile/runtime.js`).
- [x] Wire mobile runtime initialization in `src/main.jsx`.
- [x] Add mobile-safe viewport and shell CSS adjustments.
- [x] Build web assets (`npm run build`).
- [x] Add Android platform (`npx cap add android`).
- [x] Add iOS platform (`npx cap add ios`).
- [x] Write architecture and setup documentation.
- [x] Add native deep-link auth recovery handling (`fermatolk://auth`).
- [x] Validate Android debug APK build with local SDK + JDK 21.
- [x] Add native CI workflow for Android APK and iOS simulator builds.
- [x] Install CocoaPods on host and run full iOS `pod install`.
- [x] Add signed Android release build script (`mobile:android:release`).
- [x] Add Android release signing config (`android/keystore.properties` support).
- [x] Add iOS Fastlane lanes for signed build and TestFlight upload.
- [x] Add manual GitHub Actions release workflow for Android/iOS.

## Open / Follow-up

- [ ] Configure repository remote (`origin`) and push branch.
- [ ] Add GitHub Actions secrets for release workflow.
- [ ] Run on real devices and verify push/keyboard/auth UX behavior.
- [ ] Add app icons/splash assets for store-ready packaging.

<!-- REPO_DOCS_REFRESH_START -->
# TASKS

Updated: 2026-04-21
Repository: `ferma-tolk-mobile`

## Immediate
- [ ] Run and verify setup command(s): `npm ci`
- [ ] Run and verify primary start command(s): `npm run dev`, `npm run start`
- [ ] Run quality checks: `npm run test`, `npm run lint`, `npm run build`
- [ ] Confirm key paths are still accurate: `src`, `api`, `public`, `docs`, `scripts`, `.github/workflows`, `README.md`, `package.json`
- [ ] Validate external metadata assumptions from `RESEARCH.md` against upstream changes.

## Next
- [ ] Prioritize top 3 reliability improvements for this repository.
- [ ] Expand automated tests around highest-risk areas.
- [ ] Tighten command documentation in README for onboarding speed.

## Ongoing Maintenance
- [ ] Keep README and architecture notes synchronized with code changes.
- [ ] Track technical debt and refactor candidates in `PLANNING.md`.
- [ ] Track unknowns and external dependencies in `RESEARCH.md`.

## Completed Recently
- [x] Repository-specific task file refreshed on 2026-04-21.
<!-- REPO_DOCS_REFRESH_END -->
