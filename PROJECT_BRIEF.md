# Project Brief

Repository: `ferma-tolk-mobile`
Path: `/home/igorkan/repos/ferma-tolk-mobile`

## Purpose

Mobile packaging and delivery repository for Ferma.Tolk using Capacitor-native wrappers around the existing React web app.

## Core Outcome

- Native platform projects generated (`android`, `ios`).
- Mobile runtime behavior enabled (status bar, keyboard, Android back handling).
- Native auth recovery deep links enabled (`fermatolk://auth`).
- Repeatable build and sync workflow available through npm scripts.
- Android debug APK build is scriptable on Linux hosts.
- CI workflow includes Android APK and iOS simulator native builds.
- Signed Android release build pipeline is in place (`.aab` + `.apk`).
- iOS Fastlane lanes are prepared for signed release and TestFlight upload.

## Primary Commands

- `npm install`
- `npm run build`
- `npm run mobile:build`
- `npm run mobile:android:debug:apk`
- `npm run mobile:android:release`
- `npm run mobile:open:android`
- `npm run mobile:open:ios`

<!-- REPO_DOCS_REFRESH_START -->
# PROJECT_BRIEF

Updated: 2026-04-21
Repository: `ferma-tolk-mobile`
Path: `/home/igorkan/repos/ferma-tolk-mobile`

## What This Repository Appears To Be
- Title: Ferma.Tolk Mobile
- Summary: Mobile-first repository for Ferma.Tolk using a **Capacitor + React + Supabase** architecture.

## Repository Hosting Metadata
- Origin Remote: `https://github.com/igor-kan/ferma-tolk-mobile.git`
- GitHub Slug: `igor-kan/ferma-tolk-mobile`
- GitHub Description: Not available
- GitHub Homepage: Not set
- GitHub Topics: None detected
- GitHub Last Push Timestamp: 2026-04-21T17:39:05Z

## Detected Stack
- Node.js, React, Vite, JavaScript

## Key Paths
- `src`
- `api`
- `public`
- `docs`
- `scripts`
- `.github/workflows`
- `README.md`
- `package.json`

## Command Quickstart
Setup:
- `npm ci`

Run:
- `npm run dev`
- `npm run start`

Quality:
- `npm run test`
- `npm run lint`
- `npm run build`

## Codebase Signals
- Files scanned (capped): 327
- Common extensions: .js, .png, .md, .json, [no_ext], .xml, .jsx
- Test signal: Test directories detected
- CI workflows present: Yes

## Immediate Risks / Gaps
- Test directories detected
- Review command reproducibility for local onboarding and CI parity.
<!-- REPO_DOCS_REFRESH_END -->
