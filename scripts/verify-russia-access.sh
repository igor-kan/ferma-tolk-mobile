#!/bin/bash
# ============================================================================
# Ferma.Tolk — Russia accessibility check
# ============================================================================
# Verifies that all critical third-party services Ferma.Tolk depends on are
# reachable from the host running this script. Run periodically (cron) from
# a Russian VPS to detect when something becomes blocked.
#
# Exits non-zero if any required service is unreachable.
# Optional services log a warning but don't fail.
# ============================================================================

set -e

PASS=0
FAIL=0

check_required() {
  local label="$1"; local url="$2"
  if curl -fsSL --max-time 10 "$url" >/dev/null 2>&1; then
    echo "✅ $label"
    PASS=$((PASS+1))
  else
    echo "❌ $label  — UNREACHABLE (required)"
    FAIL=$((FAIL+1))
  fi
}

check_optional() {
  local label="$1"; local url="$2"
  if curl -fsSL --max-time 10 "$url" >/dev/null 2>&1; then
    echo "✅ $label"
  else
    echo "⚠️  $label  — unreachable (optional or has fallback)"
  fi
}

echo "=== Required for build / CI ==="
check_required "npm registry"          "https://registry.npmjs.org/"
check_required "GitHub API"            "https://api.github.com/"

echo
echo "=== Required for runtime (cloud config) ==="
check_required "Supabase Cloud"        "https://supabase.com/"
check_required "Supabase API base"     "https://api.supabase.com/"
check_required "Let's Encrypt ACME"    "https://acme-v02.api.letsencrypt.org/directory"

echo
echo "=== Cloud providers (current production) ==="
check_optional "Vercel"                "https://vercel.com/"
check_optional "Vercel API"            "https://api.vercel.com/"
check_optional "Deepgram API"          "https://api.deepgram.com/v1/projects"

echo
echo "=== Russian fallbacks (for resilience) ==="
check_optional "Yandex Cloud"          "https://cloud.yandex.ru/"
check_optional "Yandex SpeechKit"      "https://stt.api.cloud.yandex.net/"
check_optional "Selectel API"          "https://api.selectel.ru/"
check_optional "Timeweb Cloud"         "https://timeweb.cloud/"

echo
echo "=== Build pipeline ==="
check_optional "Playwright CDN"        "https://playwright.azureedge.net/"
check_optional "Docker Hub"            "https://hub.docker.com/v2/"

echo
echo "=== Summary: $PASS passed, $FAIL failed ==="
exit "$FAIL"
