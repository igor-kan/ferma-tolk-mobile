# Planning

## Goal

Deliver a mobile-buildable Ferma.Tolk repository with native packaging support and minimal regression risk.

## Phases

1. Baseline analysis
- Inspect existing app architecture and mobile readiness.
- Compare delivery methods (RN rewrite vs Expo vs Capacitor).

2. Repository creation
- Create `ferma-tolk-mobile` as a standalone git repository.
- Copy source code and remove build/runtime artifacts.

3. Mobile runtime integration
- Add Capacitor dependencies.
- Add `capacitor.config.json`.
- Scaffold `android/` and `ios/` native projects.
- Add `src/mobile/runtime.js` and initialize from app entrypoint.

4. Validation
- Run `npm install`.
- Run `npm run build`.
- Run `npx cap sync`.
- Verify scripts and project structure.

5. Handoff
- Document architecture rationale and execution commands.
- Document known host limitations (CocoaPods/Xcode absent in this environment).

<!-- REPO_DOCS_REFRESH_START -->
# PLANNING

Updated: 2026-04-21
Repository: `ferma-tolk-mobile`

## Goal
Maintain a clear execution roadmap for **ferma-tolk-mobile** based on current codebase signals.

## Current Baseline
- Stack: Node.js, React, Vite, JavaScript
- Codebase scan size: 327 files (capped)
- Test signal: Test directories detected
- CI workflows present: Yes
- GitHub Remote: igor-kan/ferma-tolk-mobile
- GitHub Last Push: 2026-04-21T17:39:05Z

## Milestones
1. Stabilize
- Validate setup/run/test workflows and fix breakage.
- Document core developer workflows in README.

2. Improve
- Expand test coverage for high-change areas.
- Reduce ambiguity in command and environment setup.

3. Harden
- Strengthen reliability, release checks, and rollback notes.
- Improve operational visibility and failure handling.

4. Iterate
- Ship prioritized improvements in small, verifiable increments.
- Reassess roadmap after each release milestone.

## Exit Criteria
- Reproducible local setup and run workflow.
- Verified quality checks for critical paths.
- Docs accurately reflect real behavior and constraints.
<!-- REPO_DOCS_REFRESH_END -->
