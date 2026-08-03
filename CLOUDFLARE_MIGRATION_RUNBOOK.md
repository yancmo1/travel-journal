# Postcards of Us Cloudflare Migration Runbook

This runbook contains the completed staging rehearsal and the owner-authorized
2026-08-03 beta cutover. It never deletes Ubuntu data. The direct Worker is
now live at `postcardsofus.com`; Ubuntu is retired as an active origin and
retained for rollback.

## 0. Current production beta target

```text
Hostname: https://postcardsofus.com
Worker: travel-journal (direct Cloudflare Worker, Production)
Fallback: https://travel-journal.yancmo.workers.dev
Account: ed7a3a18b893e8de24e7e0ab063c1c72
D1: postcards-of-us-beta-db (d0b69e24-03e0-49cf-8205-265958dfd441)
R2: postcards-of-us-beta-media (private)
Migration endpoints: disabled; /api/migration/status returns 404
Former Sites custom-domain attachment: removed; project retained for history
Ubuntu: retired active origin; source and final backups retained for rollback
```

The live cutover evidence is recorded in `CLOUDFLARE_LIVE_SMOKE.md` and the
implementation plan. Do not operate two independent writable production
origins.

## 0.2 Current isolated staging target

Worker: travel-journal-staging
URL: https://travel-journal-staging.yancmo.workers.dev
Deployment: d5ac1bc6-345f-4a93-b61c-0c4c0d53fd2f
D1: postcards-of-us-staging-db (99f58f09-2bd0-49ec-aec5-9e290af239c3)
R2: postcards-of-us-staging-media (private)
Config: wrangler.staging.toml
Custom domain: none

This target is separate from production and is the approved restore/test
environment for destructive, migration, and load checks.

## 0.1 Historical beta target

The isolated beta target used for the first migration rehearsal is:

```text
Worker: https://travel-journal.yancmo.workers.dev
D1: postcards-of-us-beta-db (d0b69e24-03e0-49cf-8205-265958dfd441)
R2: postcards-of-us-beta-media (private)
Migration endpoints: disabled after import
```

It is configured by the repository `wrangler.toml`. This workers.dev URL is
retained as an operational fallback and direct diagnostic target.

## 1. Freeze and inventory the Ubuntu source

Run on `ubuntumac` from the deployed project directory:

```bash
PROJECT_DIR=/opt/travel-journal \
ENV_FILE=/opt/travel-journal/.env.production \
OUTPUT_DIR=/tmp/postcards-migration-export-$(date -u +%Y%m%dT%H%M%SZ) \
bash scripts/cloudflare-migration-export.sh
```

The export is read-only. Preserve the generated database JSONL files and
`media-manifest.tsv` as a controlled migration artifact. Do not commit them.

## 2. Prepare a household-scoped target artifact

```bash
node scripts/cloudflare-migration-prepare.mjs \
  --input /path/to/postcards-migration-export \
  --output /path/to/postcards-migration-prepared \
  --household-id 1 \
  --household-name "Legacy Family"
```

Preparation fails on unsafe paths, missing relationships, or missing media
manifest entries. It produces target JSONL database batches, a checksummed
media upload manifest, and household-scoped R2 keys. It also makes any source
media not referenced by a legacy photo row visible for owner review; do not
silently discard those files.

## 3. Validate without writing

Use the staging hostname and a short-lived `MIGRATION_TOKEN`:

```bash
node scripts/cloudflare-migration-import.mjs \
  --base-url https://staging.example.invalid \
  --token "$MIGRATION_TOKEN" \
  --artifacts /path/to/postcards-migration-prepared \
  --media-root /srv/travel-journal/data/photos
```

Without `--apply`, the importer only reads target status and reports the
artifact counts. It refuses `postcardsofus.com` unless `--allow-production` is
explicitly supplied.

## 4. Apply to a fresh staging target

Before applying, confirm the staging D1/R2 resources are separate from
production and that every committed migration in `drizzle/`—currently through
`0013_puzzling_scarecrow.sql`—has been applied to staging through the
selected Sites deployment workflow. Then run the same command with `--apply`.

The importer verifies every local media size and SHA-256 before upload. The
Worker verifies the body checksum again before writing each R2 object. Database
rows are imported in foreign-key order and use `INSERT OR IGNORE`, making a
retry safe for the same prepared artifact. By default, `--apply` refuses a
non-empty target and verifies the resulting table counts; use
`--allow-existing-target` only for a deliberately reviewed continuation. Fresh
target verification also compares the total R2 media bytes with the prepared
manifest.

If the legacy source has usernames but no email column, the beta login bridge
accepts an address whose local part matches the imported username. After the
existing password hash verifies, that address is saved on the imported user so
account recovery and invitations can be configured normally.

## 5. Verify staging

- Compare every table count with the source export.
- Compare media object count, total bytes, and source/target manifest hashes.
- Open representative records from each household and inspect original,
  display, and thumbnail delivery.
- Test login, invitations, sharing, revocation, CRUD, export, deletion,
  location backfill, Photo Intelligence, backup, and cross-household denial.
- Keep `ENABLE_HOUSEHOLD_DELETION=false` during ordinary beta operation. Enable
  it only for a rehearsed, owner-approved maintenance window after confirming
  the backup and retention policy in the questions file.
- Run the clean-room restore drill before considering cutover.
- Remove or rotate `MIGRATION_TOKEN` after the rehearsal.

The completed beta rehearsal imported 1 household, 2 users, 2 memberships, 12
travelers, 3 journeys, 96 trips, 158 links, 41 photos, and 112 private R2
objects totaling `72,274,558` bytes. The endpoint returned 404 after it was
disabled again. Thirteen unreferenced Ubuntu media files remain outside the
beta pending the owner decision in the questions file.

The isolated staging restore was rechecked on 2026-08-03 after live beta
activity. All 21 application table counts matched production: 2 users, 1
household, 2 memberships, 13 travelers, 4 journeys, 92 trips, 155
trip-traveler links, 41 photos, 2 sessions, 5 audit events, 7 idempotency
keys, and zero rows in the remaining auxiliary tables. All 112 referenced
private R2 keys were present, and staging /api/health returned 200 with
database, storage, and schema ready.

## 6. Production cutover record and rollback

The cutover completed after the owner authorized the change. The exact
sequence was: remove the two former root A records, attach the root custom
domain to the direct Worker, remove the former Sites custom-domain attachment,
then verify the live hostname. The former Sites project and Ubuntu source were
not deleted.

If rollback is required, first stop or freeze Cloudflare writes and preserve
the accepted-write export and logs. With explicit owner approval, remove or
reverse the direct Worker custom-domain attachment and restore a reviewed
fallback route. Reconcile any post-cutover writes before reopening any legacy
write path. Do not run an unreviewed reverse import into PostgreSQL, and do not
allow both the Worker and Ubuntu to be writable production origins.

Remaining operational gates—email delivery, monitoring, off-account backup
retention, and full authenticated workflow coverage—are still required before
broad public signup. The current snapshot's backup artifact integrity and
isolated staging restore are documented separately in the deployment inventory.

## 7. Historical production gate

For a future migration or rebuild, do not run another production import or
deployment until the unresolved decisions in
`CLOUDFLARE_MIGRATION_QUESTIONS.md` are recorded, staging passes twice, the
rollback path is rehearsed, and `scripts/cloudflare-deployment-preflight.sh
production` passes with the required evidence variables.
