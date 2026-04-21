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

## Build Android APK (Debug)

```bash
npm run mobile:android:debug:apk
```

Output:
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Build Android Release (Signed)

```bash
npm run mobile:android:release
```

Signing configuration is read from `android/keystore.properties` or from env vars:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Outputs:
- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

## iOS Fastlane Lanes (TestFlight)

Fastlane is configured in `ios/App/fastlane`:

- `bundle exec fastlane ios release_build` (signed IPA build only)
- `bundle exec fastlane ios beta` (build + upload to TestFlight)

Required signing/App Store env vars:

- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY` (base64-encoded key content)
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `IOS_BUNDLE_IDENTIFIER` (optional override, defaults to `com.fermatolk.mobile`)

## Environment Variables

Copy and fill:

- `.env.local`
- `.env.test`

Required Supabase keys follow the same pattern as `ferma.tolk`.
For mobile/native shells, set:

- `VITE_API_BASE_URL=https://ferma-tolk.youridea.live`
- `VITE_MOBILE_AUTH_REDIRECT_URL=fermatolk://auth#recovery`

This ensures `/api/analytics` and `/api/speech` resolve correctly on Android/iOS.
The mobile auth redirect enables password-recovery links to open directly in the app.

Add `fermatolk://auth#recovery` to Supabase Auth redirect URL allow-list.

## Linux/Arch Prerequisites

Use JDK 21 for Android builds (JDK 26 is too new for this Gradle setup):

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export PATH="$JAVA_HOME/bin:$PATH"
```

Install Android command-line SDK tools (user-local):

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
# Download commandlinetools-linux-*_latest.zip and extract into:
# ~/Android/Sdk/cmdline-tools/latest
```

Install required Android SDK packages:

```bash
export ANDROID_HOME=~/Android/Sdk
export ANDROID_SDK_ROOT=~/Android/Sdk
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

## Notes

- CocoaPods was installed via Ruby gems in this environment.
- `pod` is available on PATH via `~/.local/bin/pod`.
- Android and iOS projects include `fermatolk://auth` deep-link handlers for recovery callbacks.
- iOS native build still requires macOS + Xcode (Linux can prepare/sync but cannot compile/sign iOS apps).
- Native CI workflow for Android + iOS simulator builds: [mobile-native.yml](/home/igorkan/repos/ferma-tolk-mobile/.github/workflows/mobile-native.yml).
- Manual release workflow (signed Android + optional iOS TestFlight): [mobile-release.yml](/home/igorkan/repos/ferma-tolk-mobile/.github/workflows/mobile-release.yml).
- Native release runbook and secrets reference: [MOBILE-NATIVE-RELEASE.md](/home/igorkan/repos/ferma-tolk-mobile/docs/MOBILE-NATIVE-RELEASE.md).
