# Cloudflare Environment Matrix

This file records names and ownership only. Secret values must never be copied
here or committed.

## Sites-managed production observations

Observed from the Sites control plane on 2026-08-03:

| Key/binding | Type | Observation | Action |
| --- | --- | --- | --- |
| `DB` | D1 binding | Declared in `.openai/hosting.json` | Verify target/resource identity through the selected owner account |
| `MEDIA` | R2 binding | Declared in `.openai/hosting.json` | Verify bucket identity, retention, and backup separation |
| `EMAIL_FROM` | Non-secret env | Present as `Postcards of Us <postcards@mail.postcardsofus.com>` | Verify SPF/DKIM/DMARC and sender authorization |
| `JWT_SECRET` | Secret | Secret entry present; value intentionally unavailable | Rotate/retain according to the final session strategy |
| `RESEND_API_KEY` | Secret | Secret entry present; value intentionally unavailable | Verify delivery with a staging test address |
| `LEGACY_BACKUP_AT` | Non-secret env | Present with the last Ubuntu backup timestamp | Replace with structured backup metadata once Cloudflare backups are active |
| `LEGACY_DATABASE_DUMP_BYTES` | Non-secret env | Present as legacy backup metadata | Preserve only as migration evidence |
| `LEGACY_PHOTO_BYTES` | Non-secret env | Present as legacy backup metadata | Preserve only as migration evidence |

## Required staging/production configuration

## Production beta configuration (2026-08-03)

The direct Worker beta is now the live production route. The workers.dev URL is
retained as an operational fallback, and the former Sites custom-domain
attachment was removed without deleting its project history.

| Item | Beta value/status |
| --- | --- |
| Worker | `travel-journal`; custom domain `postcardsofus.com` active |
| Operational fallback | `travel-journal.yancmo.workers.dev` |
| Account | `Yancmo's Account`, `ed7a3a18b893e8de24e7e0ab063c1c72` |
| `DB` | `postcards-of-us-beta-db`, `d0b69e24-03e0-49cf-8205-265958dfd441` |
| `MEDIA` | `postcards-of-us-beta-media`, private R2 bucket |
| `ASSETS` | Worker static assets from `dist/client` |
| Observability | Workers Logs enabled with 10% head sampling |
| Schedule | `*/15 * * * *` |
| `ENABLE_MIGRATION_ENDPOINTS` | `false` after the one-time beta import |
| `JWT_SECRET` | Configured as a Worker secret; value not recorded |
| `MIGRATION_TOKEN` | Temporary secret deleted after the beta import; endpoint disabled |
| `RESEND_API_KEY` | Configured in production and staging; post-cutover delivery test remains open |

The beta import produced 1 household, 2 users, 12 travelers, 3 journeys, 96
trips, 158 trip-traveler links, 41 photos, and 112 private R2 objects. No
custom domain or production DNS route was changed during the import; the live
domain cutover happened afterward and is recorded in the runbook and smoke log.

## Isolated staging configuration (2026-08-03)

Staging is deployed from [wrangler.staging.toml](wrangler.staging.toml) and
is intentionally separate from production:

| Item | Staging value/status |
| --- | --- |
| Worker | `travel-journal-staging` |
| Hostname | `travel-journal-staging.yancmo.workers.dev` |
| Deployment | `0b23ba81-85e8-47c6-a5c7-e57d3c55ad6a` |
| `DB` | `postcards-of-us-staging-db`, `99f58f09-2bd0-49ec-aec5-9e290af239c3` |
| `MEDIA` | `postcards-of-us-staging-media`, private R2 bucket |
| `ASSETS` | Worker static assets from `dist/client` |
| `JWT_SECRET` | Separate random Worker secret; value not recorded |
| Migration endpoints | Disabled; no migration secret configured |
| Production route | Not attached; staging has no custom domain |
| Observability | Workers Logs enabled with 10% head sampling |

The restored staging database matches the production snapshot across all 21
application tables, and all 112 referenced private media keys are present in
the staging R2 bucket. Staging health returned database/storage/schema ready
with `empty:false`.

- [ ] `GOOGLE_PLACES_API_KEY` secret, only if Google Places remains enabled
- [ ] `GOOGLE_PLACES_CACHE_TTL_MS` non-secret configuration
- [ ] `GOOGLE_PLACES_CACHE_MAX_ENTRIES` non-secret configuration
- [ ] `LOCATION_CACHE_MAX_ENTRIES` non-secret bounded reverse-geocoder cache setting
- [ ] `LOCATION_USER_AGENT` non-secret provider identification
- [ ] `MAX_LOCATION_BACKFILL_PER_RUN` non-secret bounded-work setting
- [x] Location backfill runs through household-scoped persistent jobs; the
      setting controls the per-job provider-call bound and defaults to `3`
- [ ] `MIGRATION_TOKEN` secret, staging/migration window only
- [ ] `ENABLE_MIGRATION_ENDPOINTS` kill switch; false except during a short,
      authenticated migration window
- [ ] `BACKUP_TOKEN` secret, if an operator-triggered backup endpoint remains
- [ ] `ENABLE_BACKUP_RUNNER` kill switch; false unless an external runner is
      explicitly configured
- [ ] `BACKUP_STALE_AFTER_HOURS` non-secret configuration
- [ ] `MAX_STORAGE_BYTES_PER_HOUSEHOLD` non-secret configuration
- [ ] `MAX_UPLOAD_BYTES` non-secret configuration
- [ ] `MAX_UPLOADS_PER_REQUEST` non-secret configuration; default 5
- [ ] `MAX_UPLOADS_PER_DAY` non-secret configuration; zero disables the cap
- [ ] `MAX_UPLOAD_BYTES_PER_DAY` non-secret configuration; zero disables the cap
- [x] `MAX_ANALYTICS_TRIPS` non-secret bounded analytics window; default 5000
- [ ] `EXPORT_MEDIA_PER_JOB` non-secret bounded export batch size; default 10
- [ ] `VITE_MAX_UPLOADS_PER_ACTION` build-time client cap, default 50
- [ ] `PHOTO_PROCESSOR_MODE` non-secret feature flag
- [ ] `VITE_USE_UPLOAD_SESSIONS` build-time flag; enable only after staging
      upload-session, checksum, retry, and cleanup tests pass
- [ ] `JOB_RUNNER_MODE` non-secret feature flag
- [ ] `ENABLE_BACKGROUND_JOBS` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_AUTOMATIC_BACKUPS` non-secret scheduled-backup kill switch
- [ ] `ENABLE_UPLOADS` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_INVITATIONS` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_SHARING` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_PLACES` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_LOCATION_LOOKUPS` non-secret kill switch; default enabled for beta
- [ ] `ENABLE_HOUSEHOLD_DELETION` non-secret destructive-operation kill switch;
      must remain false until deletion policy and maintenance procedures are
      approved
- [ ] `PUBLIC_REGISTRATION_ENABLED` non-secret feature flag, false for beta
- [ ] `VITE_LEGACY_BEARER_AUTH` build-time compatibility flag; false for Cloudflare beta, true only for Ubuntu compatibility testing
- [ ] `LOG_LEVEL` and environment name

## Ownership rules

- [ ] Local `.env.example` and hosted key names remain aligned.
- [ ] Staging and production use different D1/R2 resources.
- [ ] Migration-only secrets are removed or disabled after migration.
- [ ] Production secrets are rotated after the migration rehearsal and again
      after any temporary operator access is removed.
- [ ] No secret value is printed by build logs, tests, deployment output, or
      the Operations page.
