#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

if [[ -z "${JAVA_HOME:-}" && -d "/usr/lib/jvm/java-21-openjdk" ]]; then
  export JAVA_HOME="/usr/lib/jvm/java-21-openjdk"
fi

if [[ -n "${JAVA_HOME:-}" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [[ -z "${ANDROID_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "ANDROID_HOME not found: $ANDROID_HOME"
  echo "Install Android SDK and set ANDROID_HOME (or ANDROID_SDK_ROOT)."
  exit 1
fi

printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

KEYSTORE_PROPS_PATH="$ANDROID_DIR/keystore.properties"

if [[ -f "$KEYSTORE_PROPS_PATH" ]]; then
  echo "Using existing $KEYSTORE_PROPS_PATH"
else
  if [[ -z "${ANDROID_KEYSTORE_PATH:-}" || -z "${ANDROID_KEYSTORE_PASSWORD:-}" || -z "${ANDROID_KEY_ALIAS:-}" || -z "${ANDROID_KEY_PASSWORD:-}" ]]; then
    echo "Missing Android signing configuration."
    echo "Either provide android/keystore.properties or set:"
    echo "  ANDROID_KEYSTORE_PATH"
    echo "  ANDROID_KEYSTORE_PASSWORD"
    echo "  ANDROID_KEY_ALIAS"
    echo "  ANDROID_KEY_PASSWORD"
    exit 1
  fi

  cat >"$KEYSTORE_PROPS_PATH" <<EOF
storeFile=${ANDROID_KEYSTORE_PATH}
storePassword=${ANDROID_KEYSTORE_PASSWORD}
keyAlias=${ANDROID_KEY_ALIAS}
keyPassword=${ANDROID_KEY_PASSWORD}
EOF
  echo "Generated $KEYSTORE_PROPS_PATH from environment variables."
fi

cd "$ANDROID_DIR"
./gradlew clean bundleRelease assembleRelease

echo "AAB ready: $ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
echo "APK ready: $ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
