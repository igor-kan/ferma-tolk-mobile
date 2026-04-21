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
