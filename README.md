# Ferma.Tolk Mobile

Mobile-first repository for Ferma.Tolk using a **Capacitor + React + Supabase** architecture.

## What This Repository Is

- A mobile app build target (Android + iOS) for the existing `ferma.tolk` React product.
- Keeps core UI/business behavior from web while packaging it as native apps.
- Adds native runtime hooks (status bar, keyboard behavior, Android back button handling).

## Why This Method

The codebase is already a React web app with mobile-shaped layout (`max-width`, bottom tab nav, safe area usage). For fastest reliable delivery with highest feature parity, this repo uses Capacitor as a native runtime around the existing app.

Detailed comparison is in [RESEARCH.md](/home/igorkan/repos/ferma-tolk-mobile/RESEARCH.md).

## Stack

- React 19 + Vite
- Supabase (`@supabase/supabase-js`)
- TanStack Query
- Capacitor 7 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`)
- Native plugins:
  - `@capacitor/app`
  - `@capacitor/status-bar`
  - `@capacitor/keyboard`

## Project Structure

- `src/` app code (copied and adapted from `ferma.tolk`)
- `src/mobile/runtime.js` mobile runtime bootstrap
- `android/` Android native project
- `ios/` iOS native project
- `capacitor.config.json` native runtime config

## Local Setup

```bash
cd /home/igorkan/repos/ferma-tolk-mobile
npm install
```

## Web Build + Native Sync

```bash
npm run mobile:build
```

This runs:
1. `vite build` to `dist/`
2. `npx cap sync` to copy web assets and sync plugins

## Open Native Projects

```bash
npm run mobile:open:android
npm run mobile:open:ios
```

## Run On Device/Emulator

```bash
npm run mobile:run:android
npm run mobile:run:ios
```

## Environment Variables

Copy and fill:

- `.env.local`
- `.env.test`

Required Supabase keys follow the same pattern as `ferma.tolk`.

## Notes

- In this environment, iOS `pod install` was skipped because CocoaPods/Xcode are not installed.
- Android platform scaffolding and Capacitor sync are complete.
