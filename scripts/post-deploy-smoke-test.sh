#!/usr/bin/env bash
set -Eeuo pipefail

# Run after a production image update. The account is supplied by environment
# variables so this test never creates disposable users in the family database.

API_URL="${API_URL:-http://127.0.0.1:3080/api}"
SMOKE_TEST_USERNAME="${SMOKE_TEST_USERNAME:-}"
SMOKE_TEST_PASSWORD="${SMOKE_TEST_PASSWORD:-}"
SAMPLE_PHOTO="${SAMPLE_PHOTO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && printf '%s' "$PWD/sample-pic/2018-05-29_17-22-17_403.jpeg")}"

if [[ -z "${SMOKE_TEST_USERNAME}" || -z "${SMOKE_TEST_PASSWORD}" ]]; then
  echo "Set SMOKE_TEST_USERNAME and SMOKE_TEST_PASSWORD for the dedicated smoke-test account."
  exit 2
fi

if [[ ! -f "${SAMPLE_PHOTO}" ]]; then
  echo "Sample photo not found: ${SAMPLE_PHOTO}"
  exit 2
fi

TOKEN=""
TRIP_ID=""

cleanup() {
  if [[ -n "${TRIP_ID}" && -n "${TOKEN}" ]]; then
    if curl --silent --show-error --fail \
      -X DELETE "${API_URL}/trips/${TRIP_ID}" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null; then
      echo "✓ Temporary smoke-test memory ${TRIP_ID} deleted."
    else
      echo "⚠ Could not delete temporary smoke-test memory ${TRIP_ID}; remove it manually." >&2
    fi
  fi
}
trap cleanup EXIT

echo "Checking ${API_URL}"
curl --silent --show-error --fail "${API_URL}/health" | grep -q '"status":"ok"'

login_response="$(curl --silent --show-error --fail \
  -X POST "${API_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "$(printf '{\"username\":\"%s\",\"password\":\"%s\"}' "${SMOKE_TEST_USERNAME}" "${SMOKE_TEST_PASSWORD}")")"

if command -v jq >/dev/null 2>&1; then
  TOKEN="$(printf '%s' "${login_response}" | jq -r '.token // empty')"
else
  TOKEN="$(printf '%s' "${login_response}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
fi

if [[ -z "${TOKEN}" ]]; then
  echo "Login succeeded without a token response."
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
trip_response="$(curl --silent --show-error --fail \
  -X POST "${API_URL}/trips" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "$(printf '{\"locationName\":\"Post-deploy smoke test %s\",\"city\":\"Smoke Test\",\"country\":\"United States\",\"state\":\"Test\",\"startDate\":\"2024-01-01\",\"endDate\":\"2024-01-01\",\"tripType\":\"Other\",\"notes\":\"Temporary post-deploy smoke test\"}' "${stamp}")")"

if command -v jq >/dev/null 2>&1; then
  TRIP_ID="$(printf '%s' "${trip_response}" | jq -r '.id // empty')"
else
  TRIP_ID="$(printf '%s' "${trip_response}" | sed -n 's/.*"id":\([0-9][0-9]*\).*/\1/p')"
fi

if [[ -z "${TRIP_ID}" ]]; then
  echo "Temporary memory was not returned with an id."
  exit 1
fi
echo "✓ Temporary memory ${TRIP_ID} created."

upload_response="$(curl --silent --show-error --fail \
  -X POST "${API_URL}/photos/${TRIP_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "photos=@${SAMPLE_PHOTO};type=image/jpeg")"

if command -v jq >/dev/null 2>&1; then
  uploaded_count="$(printf '%s' "${upload_response}" | jq -r '.count // 0')"
else
  uploaded_count="$(printf '%s' "${upload_response}" | sed -n 's/.*"count":\([0-9][0-9]*\).*/\1/p')"
fi

if [[ "${uploaded_count}" -lt 1 ]]; then
  echo "Photo upload returned no saved photos."
  exit 1
fi
echo "✓ ${uploaded_count} photo uploaded."

photos_response="$(curl --silent --show-error --fail \
  "${API_URL}/photos/${TRIP_ID}" \
  -H "Authorization: Bearer ${TOKEN}")"
if ! printf '%s' "${photos_response}" | grep -Eq 'photo-|2018-05-29_17-22-17_403.jpeg'; then
  echo "Uploaded photo was not returned by the verification request."
  exit 1
fi
echo "✓ Uploaded photo verified through the read path."

# The EXIT trap removes the temporary memory and its photo directory.
echo "Post-deploy smoke test passed."
