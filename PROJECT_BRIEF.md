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

## Primary Commands

- `npm install`
- `npm run build`
- `npm run mobile:build`
- `npm run mobile:android:debug:apk`
- `npm run mobile:open:android`
- `npm run mobile:open:ios`
