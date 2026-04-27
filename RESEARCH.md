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

<!-- REPO_DOCS_REFRESH_START -->
# RESEARCH

Updated: 2026-04-21
Repository: `ferma-tolk-mobile`

## Focus Areas
- Domain keywords: ferma tolk mobile
- Technology stack: Node.js, React, Vite, JavaScript
- Upstream repository context: igor-kan/ferma-tolk-mobile

## Open Questions
- Which modules in `ferma-tolk-mobile` represent the highest reliability risk?
- Which external services/APIs/framework versions require compatibility validation?
- Which performance/security constraints should be tested before next release?

## Investigation Backlog
- [ ] Capture architecture notes from key paths: `src`, `api`, `public`, `docs`, `scripts`, `.github/workflows`, `README.md`, `package.json`
- [ ] Identify missing monitoring/test coverage for production-critical paths.
- [ ] Document known limitations and mitigation strategies.

## Codebase Signals
- Files scanned (capped): 327
- Common extensions: .js, .png, .md, .json, [no_ext], .xml, .jsx
- Test signal: Test directories detected
- CI workflows present: Yes

## Web Research Signals
- Origin Remote: `https://github.com/igor-kan/ferma-tolk-mobile.git`
- GitHub Slug: `igor-kan/ferma-tolk-mobile`
- GitHub Description: Not available
- GitHub Homepage: Not set
- GitHub Topics: None detected
- GitHub Last Push Timestamp: 2026-04-21T17:39:05Z

## Official Stack References
- `Node.js: https://nodejs.org/en/docs`
- `React: https://react.dev`
- `Vite: https://vite.dev/guide/`
- `JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript`

## Evidence Log
- Keep references to benchmark runs, incident notes, dependency advisories, and design decisions here.
<!-- REPO_DOCS_REFRESH_END -->
