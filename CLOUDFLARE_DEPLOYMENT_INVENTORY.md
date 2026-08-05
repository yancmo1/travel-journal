# Cloudflare Deployment Inventory

**Last reviewed:** 2026-08-04
**Environment:** Repository, public live-site, and Sites control-plane inspection  
**Status:** Direct Cloudflare Worker beta is live production; the former Sites and Ubuntu routes are retired as active origins; rollback retention remains active

## Current production beta deployment — cutover complete

- Hostname: `https://postcardsofus.com`
- Runtime: direct Cloudflare Worker `travel-journal` in `Yancmo's Account`
  (`ed7a3a18b893e8de24e7e0ab063c1c72`)
- Live deployment: `ee9d0d2a-3fc4-4e14-938c-1d3a2f54689f`
- Custom domain: active on the Worker Production environment
- D1: `postcards-of-us-beta-db` (`d0b69e24-03e0-49cf-8205-265958dfd441`)
- R2: `postcards-of-us-beta-media` (private)
- Bindings: `DB`, `MEDIA`, and `ASSETS`
- Live evidence on 2026-08-03: homepage `200`; health `200` with database,
  storage, and schema ready; manifest `200` with
  `application/manifest+json`; unauthenticated auth `401`; migration status
  `404`.
- The old root A records were removed, the direct Worker custom domain was
  attached, and the former Sites custom-domain attachment was removed.
- `www.postcardsofus.com` is not configured; the beta cutover is for the root
  hostname requested by the owner.
- Ubuntu is retired as an active origin. The server, source data, and final
  backups remain retained for the rollback window; no destructive server
  shutdown or data deletion was performed.

## Current public deployment

- Hostname: `https://postcardsofus.com`
- Public edge: Cloudflare
- Current application runtime: direct Worker `travel-journal` (see the
  production beta section above).

### Former Sites deployment retained for rollback history

- Former Worker: `yancmo--postcards-of-us`
- Former Sites project: `appgprj_6a6e58b91e608191aef8c1102f6b8416`
- Former production version: 8
- Former source commit: `749e93c892006ed5adb10ecbdd4b522ae6677e8b`
- Former custom-domain attachment: removed on 2026-08-03; the project and
  version history remain intact.

## Direct Cloudflare beta deployment

Created and deployed on 2026-08-03 from this working tree. It is now the live
production beta; the workers.dev URL remains an operational fallback:

- Worker: `travel-journal`
- URL: `https://travel-journal.yancmo.workers.dev`
- Account: `Yancmo's Account` (`ed7a3a18b893e8de24e7e0ab063c1c72`)
- Latest deployment: `ee9d0d2a-3fc4-4e14-938c-1d3a2f54689f`
- Schedule: `*/15 * * * *`
- D1: `postcards-of-us-beta-db` (`d0b69e24-03e0-49cf-8205-265958dfd441`)
- R2: `postcards-of-us-beta-media` (private, standard storage)
- Bindings: `DB` -> beta D1, `MEDIA` -> beta R2, `ASSETS` -> Worker assets
- Migration endpoints: disabled after import
- Beta health after import: database connected, storage connected, schema
  ready, `empty:false`

### Remote capacity baseline — 2026-08-03

Read-only Wrangler inspection recorded the current resource baseline:

- Production D1: 22 tables, 462,848 bytes, 797 reads and 471 writes in the
  preceding 24 hours; read replication is disabled and the database is in
  WNAM.
- Staging D1: 22 tables, 462,848 bytes, 89 reads and 104 writes in the
  preceding 24 hours; read replication is disabled and the database is in
  WNAM.
- Production R2: 227 objects and 145 MB in the Standard storage class.
- Staging R2: 113 objects and 72.3 MB in the Standard storage class.
- These are an inventory snapshot, not a capacity guarantee. Usage dashboards,
  threshold alerts, D1 recovery policy, and a no-surprise upgrade policy remain
  open before broader beta growth.

### Production recovery snapshot — verified 2026-08-03

- `_backups/latest.json` reports the latest successful scheduled snapshot at
  `2026-08-03T13:30:16.856Z`; it is configured and not stale under the current
  30-hour application freshness window.
- The database artifact is 127,070 bytes with SHA-256
  `a0256602486fbb98df897372624b445c7eee9a82dbdce44baf057bbb00b0283b`, and
  the downloaded artifact hash matched the manifest exactly.
- The private media manifest hash matched
  `461ec316891b4204a44d8844bd9c06e5ee024f78bbccb832363e0787d2cea4ce` and
  contains 112 household-namespaced objects totaling 72,274,558 bytes.
- This verifies current backup creation and manifest integrity. An independent
  off-account copy, D1 Time Travel policy, and a repeatable remote clean-room
  restore remain operational decisions/gates.

## Isolated staging restore — verified

- Worker: `travel-journal-staging`
- URL: `https://travel-journal-staging.yancmo.workers.dev`
- Deployment: `0b23ba81-85e8-47c6-a5c7-e57d3c55ad6a`
- D1: `postcards-of-us-staging-db`
  (`99f58f09-2bd0-49ec-aec5-9e290af239c3`)
- R2: `postcards-of-us-staging-media` (private)
- Config: [wrangler.staging.toml](wrangler.staging.toml)
- All 14 migrations applied; staging uses a separate random `JWT_SECRET`.
- Read-only restore verification on 2026-08-03 matched production across all
  21 application tables: 2 users, 1 household, 2 memberships, 13 travelers,
  4 journeys, 92 trips, 155 trip-traveler links, 41 photos, 2 sessions,
  5 audit events, 7 idempotency keys, and zero rows in the remaining auxiliary
  tables.
- All 112 referenced private R2 object keys were checked in staging and were
  present after the retry pass. No production objects were modified.
- Staging health returned `200` with database, storage, and schema connected;
  `empty:false`. It has no custom domain and is not the production route.

## Repository deployment surfaces

### GitHub Actions production deployment

- Production source branch: `main`
- Deployment workflow: `.github/workflows/cloudflare-deploy.yml`
- Trigger: push to `main` or manual workflow dispatch
- Required GitHub Actions environment: `production`
- Required environment secrets: `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`
- The workflow installs dependencies, verifies generated migrations, runs the
  test suite, builds the Worker assets, and deploys `wrangler.toml` to Worker
  `travel-journal`.
- `dev` is the local integration branch. It does not deploy production.

| Surface | Current evidence | Intended role |
| --- | --- | --- |
| `.openai/hosting.json` | Sites project ID with `DB` and `MEDIA` bindings | Active Cloudflare-native build/resource declaration |
| `vite.config.js` | Bundles `worker/sites-static.js` to `dist/server/index.js` | Worker-compatible build output |
| `worker/sites-static.js` | D1/R2 Worker implementation and migration bridge | Cloudflare API/static runtime, incomplete |
| `db/schema.ts` | SQLite/Drizzle schema | D1 source schema |
| `drizzle/*.sql` | Generated migrations | D1 migration history |
| `docker-compose.production.yml` | Nginx, Express, PostgreSQL, Watchtower | Current Ubuntu production path |
| `.github/workflows/publish-containers.yml` | GHCR container workflow | Ubuntu image publishing path |

## Known identifiers and bindings

| Item | Value/status |
| --- | --- |
| Sites project | `appgprj_6a6e58b91e608191aef8c1102f6b8416` |
| D1 logical binding | `DB` |
| R2 logical binding | `MEDIA` |
| Production hostname | `postcardsofus.com` |
| Staging hostname | Pending owner confirmation; suggested `staging.postcardsofus.com` |
| D1 resource ID | Sites binding exists logically as `DB`; underlying resource ID not exposed in inventory |
| R2 bucket name/ID | Sites binding exists logically as `MEDIA`; underlying resource ID not exposed in inventory |
| Former Sites Worker/route | `yancmo--postcards-of-us`; custom-domain attachment removed, retained as rollback history |
| Direct production Worker/route | `travel-journal`; `postcardsofus.com` custom domain active |
| Direct beta fallback | `travel-journal.yancmo.workers.dev` |
| Cloudflare account | `Yancmo's Account` (`ed7a3a18b893e8de24e7e0ab063c1c72`) |
| Direct beta account | `ed7a3a18b893e8de24e7e0ab063c1c72` (`Yancmo's Account`) |
| Direct beta D1 | `postcards-of-us-beta-db`, `d0b69e24-03e0-49cf-8205-265958dfd441` |
| Direct beta R2 | `postcards-of-us-beta-media`, private access |
| Resend sender/domain | Configured as `Postcards of Us <postcards@mail.postcardsofus.com>`; domain verified in Resend |

## Current source data

Exact counts and byte totals must be generated from the Ubuntu source during a
controlled inventory run. They are intentionally not guessed or copied into
this document.

- PostgreSQL table counts from Ubuntu legacy source: users 2, journeys 3,
  photos 41, travelers 12, trip_travelers 158, trips 96
- Broad photo filesystem inventory: 152 files, 120,594,159 bytes
- Migration export inventory (excludes `photos/temp`): 125 files,
  73,719,626 bytes; the prepared household import references 112 objects and
  leaves 13 unreferenced objects pending the orphan-media decision.
- Latest export rehearsal: `ubuntumac`, generated `2026-08-03T13:18:07Z`, manifest
  SHA-256 `f2e7011b990fd9479c01ac1dbe2345f5851a64080ae9eaa7ffdb36d2ee07d231`.
- Prepared artifact counts: 1 household, 2 users, 2 memberships, 12
  travelers, 3 journeys, 96 trips, 158 trip-traveler links, 41 photos, and
  112 referenced media objects.
- Beta import result: 1 household, 2 users, 2 memberships, 12 travelers, 3
 journeys, 96 trips, 158 trip-traveler links, 41 photos, and 112 private R2
 objects totaling `72,274,558` bytes. The source manifest contains 125 files
 totaling `73,719,626` bytes; 13 unreferenced files remain on Ubuntu pending
 the orphan-media decision.
- Current live D1/runtime snapshot at the staging restore (2026-08-03): 1
  household, 2 users, 2 memberships, 13 travelers, 4 journeys, 92 trips, 155
  trip-traveler links, 41 photos, 2 sessions, 5 audit events, and 7
  idempotency keys. The increase from the initial import counts reflects live
  beta activity after cutover.
- Latest Ubuntu backup status: database dump and photo backup succeeded at
  `2026-08-02T08:27:09Z`; database dump 12,920 bytes
- D1 table counts: pending read-only Sites/D1 inventory; the Sites environment
  contains legacy backup metadata for the Ubuntu dataset
- Current Ubuntu image revision: `d4908f20795a41e69e21b045d07f3a25eb844b90`
  on the running backend/frontend containers; Sites live commit recorded above

## Phase 0 completion checklist

- [x] Former Sites-managed runtime and custom domain recorded for rollback history
- [x] Direct Cloudflare account and production Worker ownership confirmed
- [x] Sites versus direct deployment decision resolved by owner; direct Worker is primary
- [x] Staging/beta resources created separately from production
- [x] Direct beta Worker, D1, and R2 identifiers recorded
- [x] Ubuntu source counts/bytes recorded
- [x] Read-only migration export and household preparation completed; orphan-media review pending
- [x] D1 target counts/checksums recorded
- [x] Redacted environment matrix recorded
- [x] Baseline smoke test saved
