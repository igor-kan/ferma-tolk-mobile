# Research: Mobile Architecture Choice

## Objective

Build a mobile version of `ferma.tolk` with strong feature parity and minimal migration risk.

## Existing Codebase Facts

- `ferma.tolk` is Vite + React + Supabase + TanStack Query.
- UI already targets phone interaction patterns:
  - fixed bottom nav
  - safe-area-aware paddings
  - constrained app shell layout
- Auth/data stack is browser/JS based and already production-integrated.

## Options Evaluated

### Option A: Full React Native / Expo rewrite

Pros:
- Best long-term native UI performance flexibility.
- Deep native ecosystem.

Cons:
- Significant rewrite of all UI screens/components.
- Higher migration risk and longer timeline.

### Option B: Expo with incremental migration from existing RN app

Pros:
- Excellent RN toolchain and deployment flow.
- Strong modern guidance for native apps.

Cons:
- Still requires RN component migration from DOM-based React UI.
- Not the fastest path for full feature parity now.

### Option C: Capacitor wrapper around existing React app (**Selected**)

Pros:
- Reuses current UI and logic almost directly.
- Fastest path to shipped Android/iOS binaries.
- Lowest migration risk for current product stage.

Cons:
- Not as “fully native UI” as RN for future highly native UX ambitions.

## Decision

Select **Capacitor** for initial mobile delivery.

Reason: it provides the best speed-to-value for this specific repository, preserving current behavior while enabling native packaging and native plugin enhancements.

## Official Sources Used

- Expo docs (project creation and cross-platform approach): https://docs.expo.dev/
- Expo “existing RN apps” overview (incremental adoption and EAS guidance): https://docs.expo.dev/bare/overview/
- Capacitor docs (web-focused native runtime): https://capacitorjs.com/docs
- Supabase React Native auth quickstart (if future RN migration is chosen): https://supabase.com/docs/guides/auth/quickstarts/react-native

## Implementation Method Chosen

1. Fork/copy `ferma.tolk` into a new repo `ferma-tolk-mobile`.
2. Add Capacitor dependencies and config.
3. Generate `android/` and `ios/` projects.
4. Add native runtime hooks (status bar, keyboard behavior, back button UX).
5. Validate production web build and native sync workflow.
