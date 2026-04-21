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

mkdir -p "$ANDROID_DIR"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

cd "$ANDROID_DIR"
./gradlew assembleDebug

echo "APK ready: $ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
