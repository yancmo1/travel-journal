# Cloudflare Live Smoke Baseline

**Captured:** 2026-08-03
**Hostname:** `https://postcardsofus.com`

## Public health check

- `GET /api/health` returned HTTP `200`.
- Response reported database `connected`, storage `connected`, and schema
  `ready`.
- The response reported `empty: false`, confirming that the live binding has
  data.
- Response headers included Cloudflare edge delivery and `no-store` plus
  `nosniff` safety headers.

## Interpretation of the baseline

This was the pre-cutover read-only baseline for the former Sites deployment.

## Live beta cutover verification

**Verified:** 2026-08-03 19:12 UTC  
**Runtime:** direct Worker `travel-journal` in Cloudflare account
`ed7a3a18b893e8de24e7e0ab063c1c72`  
**Deployment:** `79cf0a49-b826-46f5-a767-f57a35467a59`  
**Route:** `https://postcardsofus.com` custom domain on Worker Production  
**Fallback:** `https://travel-journal.yancmo.workers.dev`

- `GET /` returned `200` and served the Postcards of Us application shell.
- `GET /api/health` returned `200` with `database: connected`,
  `storage: connected`, `schema: ready`, and `empty: false`.
- `GET /manifest.webmanifest` returned `200` with
  `application/manifest+json`.
- `GET /api/auth/me` returned JSON `401` with `Invalid or expired session`.
- `GET /api/migration/status` returned JSON `404` with `Not found`.
- Responses included Cloudflare edge delivery plus the Worker security
  headers, including HSTS, CSP, `nosniff`, and `X-Frame-Options: DENY`.
- The former Sites custom-domain attachment was removed before verification;
  the former project and Ubuntu source remain available for rollback history.

## Isolated staging restore verification

Verified: 2026-08-03 after the production snapshot was restored
Runtime: travel-journal-staging
URL: https://travel-journal-staging.yancmo.workers.dev
Deployment: 4cbde08c-db5e-4ec8-b9d3-5bc7d0d82b47

- Staging uses D1 postcards-of-us-staging-db
  (99f58f09-2bd0-49ec-aec5-9e290af239c3) and private R2
  postcards-of-us-staging-media; both are separate from production.
- GET /api/health returned 200 with database, storage, and schema ready and
  empty:false.
- All 21 application table counts matched the production snapshot.
- All 112 referenced private R2 object keys were present after the retry pass.
- No custom domain or production resource was changed during the restore.

## Post-deployment recovery snapshot verification

**Verified:** 2026-08-03 after Worker deployment `3ed36836-237f-4d90-be68-5592bab64196`

- `GET /api/health` returned `200` with database, storage, and schema ready and
  `empty:false`.
- `GET /api/auth/me` returned `401` for an unauthenticated request.
- `GET /api/migration/status` returned `404`, confirming migration routes remain
  disabled in production.

## Static cache verification

**Verified:** 2026-08-03 after Worker deployment `8b80ff28-6f42-460c-a6dd-095f2b457ca9`

- The deployed hashed JavaScript asset returned `CF-Cache-Status: HIT` and
  `Cache-Control: public, max-age=31536000, immutable`.
- The application shell returned `Cache-Control: public, max-age=60,
  must-revalidate` on the live root.
- Staging showed the same cache policy, confirming production/staging parity.

## Observability configuration

- Production and staging Wrangler configurations enable native Workers Logs
  with a 10% head-sampling rate.
- This is a configuration/deployment check; dashboard event volume, alert
  thresholds, and retention still require an operator review during beta.

## Invitation retry-safety deployment

**Verified:** 2026-08-03 after Worker deployment `f5c8e289-c0ec-4553-b3f5-60d0b487d419`

- Production `/api/health` returned `200` with database, storage, and schema
  ready and `empty:false`.
- Production `/api/auth/me` returned `401` without a session.
- Production `/api/migration/status` returned `404`; migration endpoints remain
  disabled.
- The invitation registration replay behavior is covered by the local D1/R2
  integration test; no production invitation or email was sent during this
  verification.

## Multipart photo checksum deployment

**Verified:** 2026-08-03 after Worker deployment `d52e2eb4-f860-4a51-b2ec-024cf3f872f1`

- Production and staging health returned database/storage/schema ready with
  `empty:false`.
- The normal multipart upload checksum contract is covered by the local
  integration test; no live photo was uploaded during this verification.
- Production `/api/auth/me` remained `401` unauthenticated and
  `/api/migration/status` remained `404`.

## Upload-session checksum parity deployment

**Verified:** 2026-08-03 after production Worker deployment `1d4b58f3-c6a5-4113-87bc-62110bfb70d8` and staging deployment `2d166c2d-e9fb-4c22-b922-6659d4cb575a`

- Session-based original, display, and thumbnail uploads now persist the
  verified SHA-256 checksum alongside their upload timestamps.
- Finalized session photos persist the original checksum in D1, matching the
  original R2 object's `sha256` metadata.
- Production and staging health returned database/storage/schema ready with
  `empty:false`.
- Production `/api/auth/me` returned `401` unauthenticated and
  `/api/migration/status` returned `404`.

## Current beta guard and staging performance verification

**Verified:** 2026-08-03 after production deployment
`ee9d0d2a-3fc4-4e14-938c-1d3a2f54689f` and staging deployment
`0b23ba81-85e8-47c6-a5c7-e57d3c55ad6a`

- Production and staging health/auth/migration guards returned `200`/`401`/`404`.
- The unauthenticated staging probe passed 240 read-only requests with zero
  failures and all route p95 values below 1,000 ms.
- An isolated temporary staging fixture passed 210 authenticated read and
  authorization requests with zero failures and all route p95 values below
  1,000 ms. The fixture was deleted afterward and verified absent.
- The authenticated rehearsal did not upload media, send email, exercise a
  real mobile browser, or make any production write.
