#!/usr/bin/env bash
set -Eeuo pipefail

# Safe local gate for a Cloudflare/Sites build. Default mode is validation only.
# Production mode intentionally requires explicit external evidence supplied by
# the operator; this script never deploys, changes DNS, or applies D1 changes.

mode="${1:-validate}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

[[ -f .openai/hosting.json ]] || { echo "Missing .openai/hosting.json" >&2; exit 1; }
[[ -s dist/server/index.js ]] || { echo "Missing dist/server/index.js; run npm run build" >&2; exit 1; }
[[ -s dist/client/index.html ]] || { echo "Missing dist/client/index.html; run npm run build" >&2; exit 1; }
[[ -s dist/client/_headers ]] || { echo "Missing static asset cache policy dist/client/_headers; run npm run build" >&2; exit 1; }
grep -Eq '^/assets/\*$' dist/client/_headers || { echo "Static asset cache policy is missing the hashed asset rule" >&2; exit 1; }
grep -Eq 'Cache-Control: public, max-age=31536000, immutable' dist/client/_headers || { echo "Static asset cache policy is missing immutable caching" >&2; exit 1; }
[[ -d drizzle ]] || { echo "Missing drizzle migration directory" >&2; exit 1; }
[[ -s drizzle/meta/_journal.json ]] || { echo "Missing Drizzle migration journal" >&2; exit 1; }

node --check worker/sites-static.js
node --check scripts/cloudflare-migration-prepare.mjs
node --check scripts/cloudflare-migration-import.mjs
git diff --check

secret_hits="$(git grep -nE \
  '^(JWT_SECRET|RESEND_API_KEY|MIGRATION_TOKEN|BACKUP_TOKEN|CLOUDFLARE_API_TOKEN)=.{8,}' || true)"
real_secret_hits="$(printf '%s\n' "${secret_hits}" | grep -E -v 'your[-_]|replace_|GENERATE|change_this|<GENERATE|^$' || true)"
if [[ -n "${real_secret_hits}" ]]; then
  echo "${real_secret_hits}"
  echo "A likely secret assignment is present in tracked project files." >&2
  exit 1
fi

if [[ "${mode}" == "production" ]]; then
  [[ "${PREFLIGHT_OWNERSHIP_CONFIRMED:-}" == "yes" ]] || { echo "Set PREFLIGHT_OWNERSHIP_CONFIRMED=yes after account/resource ownership review." >&2; exit 1; }
  [[ "${PREFLIGHT_STAGING_PASSED:-}" == "yes" ]] || { echo "Set PREFLIGHT_STAGING_PASSED=yes after staging contract, tenant, photo, email, and restore tests." >&2; exit 1; }
  [[ "${PREFLIGHT_MIGRATION_CHECKSUMS_MATCH:-}" == "yes" ]] || { echo "Set PREFLIGHT_MIGRATION_CHECKSUMS_MATCH=yes after a rehearsal checksum comparison." >&2; exit 1; }
  [[ "${PREFLIGHT_ROLLBACK_REHEARSED:-}" == "yes" ]] || { echo "Set PREFLIGHT_ROLLBACK_REHEARSED=yes after rollback rehearsal." >&2; exit 1; }
  [[ "${PREFLIGHT_GO_NO_GO_OWNER:-}" == "yes" ]] || { echo "Set PREFLIGHT_GO_NO_GO_OWNER=yes after naming the cutover owner." >&2; exit 1; }
fi

echo "Cloudflare deployment preflight passed in ${mode} mode."
