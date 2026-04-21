# Mobile Native Release Runbook

## Scope

This runbook covers signed release builds for:

- Android (`.aab` + `.apk`)
- iOS (signed `.ipa` + optional TestFlight upload)

## Android Signed Release

### Local build command

```bash
npm run mobile:android:release
```

### Signing inputs

Option 1:
- Provide `android/keystore.properties`

Option 2:
- Provide env vars and let the script generate `android/keystore.properties`:
  - `ANDROID_KEYSTORE_PATH`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

### Outputs

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

### Required local prerequisites

- JDK 21
- Android SDK platform 35 + build-tools 35.0.0
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` set

## iOS Signed Release + TestFlight

Fastlane files:
- `ios/App/fastlane/Fastfile`
- `ios/App/fastlane/Appfile`
- `ios/App/fastlane/Matchfile`

### Lanes

- `bundle exec fastlane ios release_build`
  - fetches signing via `match`
  - builds signed IPA (`ios/App/build/FermaTolk.ipa`)

- `bundle exec fastlane ios beta`
  - runs `release_build`
  - uploads IPA to TestFlight

### Required env vars

- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY` (base64-encoded private key content)
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `IOS_BUNDLE_IDENTIFIER` (optional, default `com.fermatolk.mobile`)
- `APP_STORE_TEAM_ID` (optional)
- `MATCH_GIT_BASIC_AUTHORIZATION` (optional, if match repo needs basic auth)

## GitHub Actions Workflows

- CI native validation:
  - `.github/workflows/mobile-native.yml`

- Manual release:
  - `.github/workflows/mobile-release.yml`
  - `workflow_dispatch` inputs:
    - `run_android`
    - `run_ios`
    - `upload_testflight`

### Android release secrets

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### iOS release secrets

- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `MATCH_GIT_URL`
- `MATCH_PASSWORD`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APP_STORE_TEAM_ID` (optional)
- `MATCH_GIT_BASIC_AUTHORIZATION` (optional)

## Operational Notes

- `android/keystore.properties`, `*.keystore`, and `*.jks` are git-ignored.
- iOS build/signing and TestFlight upload require macOS with Xcode.
- Never commit live signing credentials or App Store keys.
