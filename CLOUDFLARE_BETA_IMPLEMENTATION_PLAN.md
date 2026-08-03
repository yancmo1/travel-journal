# Postcards of Us Cloudflare Beta Implementation Plan

**Audience:** Luna and future maintainers  
**Status:** Live Cloudflare beta cutover complete; Phase 0 and the cutover portion of Phase 10 are complete. Beta stabilization, rollback-window verification, and public-signup gates remain open.
**Goal:** Move `postcardsofus.com` from the Ubuntu Docker origin to a secure,
Cloudflare-native beta without losing features, data, privacy, or a tested
rollback path. Build the foundation so individual components can scale or be
replaced later without rewriting the product.

## 1. Definition of success

The migration is complete only when all of the following are true:

- [x] `postcardsofus.com` serves the application from the intended Cloudflare
      account and no application request depends on the Ubuntu server.
- [x] D1 is the authoritative structured database and R2 is the authoritative
      photo store.
- [ ] Every existing user workflow has automated contract coverage and passes
      against the Cloudflare deployment.
- [ ] Every private record and photo is protected by a server-side household
      authorization check.
- [ ] Photo originals, display images, and thumbnails are handled deliberately;
      `thumbnail_r2_key` never points to an unprocessed original by accident.
- [ ] PostgreSQL and filesystem data have been migrated with counts, checksums,
      and representative visual verification.
- [ ] Password reset, invitations, session invalidation, and transactional email
      work in production.
- [ ] Backup creation and a clean-room restore have both been demonstrated.
- [ ] Monitoring, quotas, rate limits, alerts, and a documented incident process
      are active.
- [x] The Ubuntu deployment is retired as an active origin, with its source and
      final backups retained for the rollback window. No server shutdown or
      destructive data deletion was performed as part of the cutover.

“Scale-ready” means household ownership, APIs, storage, jobs, and migrations
have stable boundaries. It does not mean prebuilding infrastructure for
millions of users before traffic exists.

## 2. Current state and release blockers

The repository already contains useful Cloudflare work:

- `.openai/hosting.json` declares the existing Sites project and logical D1
  (`DB`) and R2 (`MEDIA`) bindings.
- `db/schema.ts` and the generated Drizzle migrations define the D1 model.
- `worker/sites-static.js` implements authentication, household membership,
  portions of the application API, migration endpoints, D1 access, R2 access,
  email, and a backup prototype.
- The browser already extracts basic EXIF date and GPS metadata with `exifr`.

The former Sites control plane deployment was published from the
Cloudflare-managed Worker `yancmo--postcards-of-us`. On 2026-08-03 its
`postcardsofus.com` custom-domain attachment was removed, its project/version
history was retained for rollback, and the root domain was attached to the
direct Worker `travel-journal` in the intended Cloudflare account. The direct
Worker is now the live beta production runtime; its workers.dev URL remains an
operational fallback.

The Cloudflare implementation must not be treated as production-ready yet:

- [x] A direct beta Worker is deployed at `travel-journal.yancmo.workers.dev`
      with separate D1/R2 resources, all migrations applied, and the migrated
      Ubuntu dataset verified by counts and media bytes. It now owns the live
      `postcardsofus.com` custom domain.

- [x] Confirm the direct Cloudflare account and production resource boundary.
      The live Worker, D1, R2, DNS zone, and custom-domain route are in account
      `ed7a3a18b893e8de24e7e0ab063c1c72`.
- [ ] Remaining parity work is concentrated in route/tenant contract coverage,
      idempotency completion, versioned export/restore, and the generic fallback
      for intentionally unimplemented operations; core photo intelligence now
      runs in-browser and collection reads use bounded cursors.
- [x] `/photos/<key>` now requires an authenticated household session or the
      exact valid share token; private media is not publicly cacheable.
- [x] Pending/failed photo processing no longer presents an original R2 object
      as a thumbnail; the gallery shows an explicit processing placeholder.
- [x] Supported browser uploads now store separate household-scoped original,
      display, and thumbnail objects; unsupported formats remain explicitly
      `pending_processing` until a processor is selected.
- [x] Photo upload retries now carry a unique client upload ID, use deterministic
      household-scoped keys, and are protected by a D1 uniqueness constraint.
- [x] New upload object keys are namespaced by household. Existing migrated keys
      still require a migration mapping.
- [x] Successful photo uploads no longer trigger a forced full backup. A
      persistent jobs table, bounded retry/lease logic, scheduled drain hook,
      and queued media cleanup path now exist; incremental backup work remains.
- [ ] The Worker is still one large file; focused media helpers and initial
      tenant/media tests now exist, but contract, migration, and restore tests
      remain open.
- [ ] Existing server-side photo tools rely on Node, `sharp`, PostgreSQL, and a
      writable filesystem; they cannot run unchanged in a Worker.
- [ ] Queries return whole collections in places where pagination is required
      for predictable D1 reads and response sizes.
- [x] Auth/place rate limiting now uses an atomic D1 batch/update pattern; load
      and abuse tests are still required.

## 3. Non-negotiable architecture decisions

Record each decision in an ADR before implementation changes it.

### 3.1 Production ownership

- Production DNS, D1, R2, secrets, logs, and billing must be controlled by the
  intended owner account.
- Preserve `.openai/hosting.json` because the current project uses Sites. During
  Phase 0, prove whether Sites provisions the required resources into the
  intended account and provides the required export and recovery controls.
- If it does not, use a direct Cloudflare deployment configuration while keeping
  the same logical bindings (`DB`, `MEDIA`) and generated Worker-compatible ESM.
- Never cut over based only on a successful build or a Cloudflare response
  header. Verify the actual Worker route, resource IDs, account ownership, and
  live data bindings.

### 3.2 Target request flow

```text
Browser/PWA
  -> Cloudflare static assets
  -> Worker API
       -> D1 for users, households, journeys, memories, and photo metadata
       -> R2 for private photo bytes and exports
       -> Resend for transactional email
       -> queue/job adapter for slow or retryable work
```

### 3.3 Data boundaries

- D1 stores structured records and R2 object metadata; it never stores photo
  bytes.
- Every household-owned table contains `household_id`.
- Every household query includes `household_id` in the predicate, even after a
  record was found by ID.
- R2 keys use a tenant namespace, for example:
  `households/<household-public-id>/trips/<trip-public-id>/<variant>/<uuid>.jpg`.
- External API identifiers should be opaque public IDs (UUIDv7/ULID or
  equivalent). Internal integer IDs may remain as database implementation
  details.
- All write endpoints accept an idempotency key or use an operation-specific
  idempotent design.

### 3.4 Photo processing

Use a replaceable `PhotoProcessor` boundary. The beta implementation may run
supported image preprocessing in the browser, but the database and upload
workflow must also support an asynchronous processor later.

For each image, represent these variants explicitly:

- `original`: private archival input, if the household elects to retain it.
- `display`: normalized orientation, bounded dimensions, web-safe encoding.
- `thumbnail`: small optimized gallery image.

Never silently label an original as a thumbnail. HEIC/HEIF and failed browser
decodes must enter a visible `pending_processing` or `processing_failed` state,
not appear as successful processed uploads.

### 3.5 Portability

- Keep application logic behind repository/service modules rather than direct
  D1 and R2 calls throughout route handlers.
- Do not expose D1-specific result shapes to the frontend.
- Maintain a versioned JSON/ZIP household export containing records, media
  manifests, and checksums.
- Background work uses a job contract so the implementation can move from a
  Worker to Queues, Workflows, Containers, or another processor later.

### 3.6 Free-tier planning assumptions

These are planning inputs, not permanent promises. Recheck the linked official
limits during Phase 0 and immediately before cutover.

- Workers Free currently allows 100,000 dynamic requests per day and 10 ms CPU
  per invocation; static asset requests are free and unlimited. Heavy image
  conversion does not belong in that request budget. See [Workers pricing and
  limits](https://developers.cloudflare.com/workers/platform/pricing/).
- D1 Free currently includes 5 million rows read and 100,000 rows written per
  day, with a 500 MB maximum per database and 5 GB total account storage. A free
  invocation is also limited in how many D1 queries it can issue. See [D1
  pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1
  limits](https://developers.cloudflare.com/d1/platform/limits/).
- R2 Standard currently includes 10 GB-month storage, 1 million Class A
  operations, 10 million Class B operations, and free egress each month. The
  R2 subscription setup may still require completing Cloudflare's checkout
  flow. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- Cloudflare Containers are not part of Workers Free. Do not design the beta to
  require a permanently available Node/`sharp` container.
- Free-plan ceilings can fail requests when exceeded. Quotas and early alerts
  are availability controls, not merely cost controls.

## 4. Implementation phases

Each phase has an exit gate. Do not begin production cutover while any earlier
gate is open.

## Phase 0 — Ownership, inventory, and baseline

**Status:** Complete

**Purpose:** Remove ambiguity about what is deployed, where it runs, and what
must be preserved.

### Tasks

- [ ] Identify the intended production Cloudflare account and record the account
      owner and at least one recovery administrator outside the repository.
- [ ] Inspect `.openai/hosting.json` project `appgprj_6a6e58b91e608191aef8c1102f6b8416`.
- [ ] Verify where its D1 and R2 resources exist, who controls them, and whether
      they are the resources intended for production.
- [ ] Record production and staging hostnames. Recommended:
      `staging.postcardsofus.com` and `postcardsofus.com`.
- [ ] Record the current Ubuntu origin, Docker image tag/commit, PostgreSQL
      version, schema version, photo root, and backup snapshot IDs.
- [ ] Export source counts for every table and counts/bytes for every photo
      variant.
- [ ] Capture representative source records: multiple households, invitations,
      journeys, travelers, shared links, rotated photos, captions, incomplete
      dates, and HEIC files.
- [ ] Run and save the current Ubuntu smoke-test result as the behavior baseline.
- [ ] Inventory every method in `src/utils/api.js` and map it to the Ubuntu and
      Worker implementations.
- [ ] Create a redacted environment-variable matrix for local, staging, and
      production. Store secret values only in the appropriate secret manager.
- [ ] Decide whether production deployment is Sites-managed or direct
      Cloudflare-account deployment; document the reason and resource ownership.

### Deliverables

- [x] `ADR-005-cloudflare-production-ownership.md`
- [x] Redacted deployment inventory with beta Worker/resource IDs and target counts
- [x] API parity matrix
- [x] Redacted environment matrix
- [x] Source data inventory with counts and byte totals; beta target counts and media-byte comparison recorded
- [x] Read-only live health baseline in `CLOUDFLARE_LIVE_SMOKE.md`
- [x] Migration rehearsal runbook in `CLOUDFLARE_MIGRATION_RUNBOOK.md`

### Exit gate

- [x] A maintainer can identify the exact live compute, D1 database, R2 bucket,
      deployment commit, account owner, and rollback origin without guessing.

## Phase 1 — Restructure the Worker and establish quality gates

**Purpose:** Make the Cloudflare backend testable before adding missing behavior.

### Tasks

- [ ] Split `worker/sites-static.js` into focused modules:
      configuration, router, auth, authorization, repositories, services,
      validation, email, media, jobs, observability, and migration-only routes.
- [ ] Define a single environment type/schema for `DB`, `MEDIA`, secrets,
      feature flags, quotas, and external-service settings.
- [x] Add a request ID to every response and structured unhandled-error log.
- [x] Add centralized JSON parsing, validation, error mapping, and security
      headers.
- [x] Add a local D1/R2-compatible test harness using the repository's
      generated migrations and Node's SQLite runtime.
- [ ] Add formatting/linting only if it can be applied without unrelated churn.
- [ ] Add CI checks for install, build, migration generation consistency, unit
      tests, and contract tests.
- [ ] Prevent deployment when generated migrations differ from `db/schema.ts`.
- [x] Keep migration endpoints disabled by default; they require both the
      explicit `ENABLE_MIGRATION_ENDPOINTS` window flag and a strong secret.
      The external backup runner has the same fail-closed flag pattern.

### Required tests

- [x] Route matching and method rejection
- [ ] Validation and error-shape tests
- [x] Authentication/session tests
- [x] Repository tests against local SQLite-compatible state
- [x] R2 key and ownership tests
- [x] Build output test for Worker-compatible ESM and static assets

### Exit gate

- [ ] A failing route, migration, or tenant-isolation test blocks deployment.

## Phase 2 — Database model and tenant isolation

**Purpose:** Make cross-household access structurally difficult and testable.

### Tasks

- [ ] Add opaque public IDs for households, users, journeys, trips, travelers,
      photos, invitations, and shares while preserving internal migration IDs.
- [ ] Add or verify `household_id` on every household-owned record.
- [x] Add composite indexes for the current household/date, household/trip,
      and gallery access patterns; active-invitation/session and broader search
      indexes remain measurement-driven follow-up work.
- [x] Add an `EXPLAIN QUERY PLAN` regression for representative trip, journey,
      and photo list queries; detail, search, timeline, and analytics plans
      remain open for the staging-shaped dataset.
- [ ] Add database constraints for allowed roles, status values, and uniqueness
      where SQLite/D1 supports them safely.
- [ ] Add `created_at`, `updated_at`, and deletion/audit semantics consistently.
- [ ] Define deletion behavior for a household, user, journey, trip, traveler,
      and photo, including associated R2 cleanup jobs.
- [ ] Replace cross-table operations that can partially succeed with batches,
      idempotent state transitions, or compensating cleanup.
- [ ] Add cursor pagination to trips, journeys, photos, operations, and search.
- [ ] Stop returning every photo with every trip list response. Return summaries
      and cover thumbnails; fetch detail pages separately.
- [ ] Add version fields or conditional updates where concurrent edits could
      overwrite each other.

### Tenant-isolation test matrix

For every read, create, update, delete, reorder, share, export, and media route:

- [ ] Owner can perform the permitted action.
- [ ] Member can perform only role-permitted actions.
- [ ] Another household receives `404` or the documented non-disclosing denial.
- [ ] A guessed numeric/public ID does not disclose existence.
- [ ] A stale session after household switching cannot access the prior context.
- [ ] A deleted, expired, or revoked membership loses access immediately.
- [x] Bulk operations reject mixed-household IDs atomically; local regression
      coverage proves mixed requests fail before any row is deleted.

### Exit gate

- [ ] Automated tests demonstrate that no application route can cross a
      household boundary.

## Phase 3 — Authentication, account recovery, and abuse prevention

**Purpose:** Make invite-only public authentication safe enough for beta users.

### Tasks

- [ ] Keep public registration disabled; require an invitation during beta.
- [x] Standardize the Cloudflare beta on opaque server-side sessions in secure,
      `HttpOnly`, `SameSite=Lax` cookies; legacy local-storage bearer auth is
      now opt-in through `VITE_LEGACY_BEARER_AUTH` for Ubuntu compatibility only.
- [x] Rotate the session token after password changes and household-sensitive
      transitions; login creates a fresh session, while privilege-change
      rotation remains gated on operator-management endpoints.
- [x] Implement session listing/revocation and “sign out everywhere” API
      endpoints.
- [x] Expose the session-revocation controls in the account UI before beta
      invitations.
- [ ] Enforce password length, compromised/common-password screening strategy,
      and constant-shape invalid-login responses.
- [ ] Make login, invitation, reset, and verification rate limits atomic.
- [ ] Rate limit by action plus a privacy-preserving combination of account and
      network/client signals. Do not rely on IP alone.
- [ ] Add escalating friction such as Turnstile for suspicious or repeated auth
      attempts.
- [ ] Add CSRF protection for cookie-authenticated state-changing requests,
      alongside same-origin validation.
- [ ] Complete email verification, invitation, forgotten-password, changed-
      password notification, and expired-token flows.
- [ ] Add Resend idempotency keys, bounded retries, failure logging, and handling
      for bounces/complaints. Resend requests now use stable operation keys and
      retry transient provider failures three times without logging message
      bodies or tokens; durable outbox/retry processing remains open.
- [ ] Configure SPF, DKIM, and DMARC for the sending domain.
- [ ] Add operator-only account disable, session revoke, and invitation revoke.
- [ ] Document later OAuth/account-linking rules before adding Google, Apple, or
      Facebook sign-in. Prevent duplicate accounts by verified email/linking.

### Exit gate

- [ ] Auth security tests, email end-to-end tests, revoked-session tests, and
      abuse-limit tests pass in staging.

## Phase 4 — Complete API parity

**Purpose:** Ensure the Cloudflare deployment can replace the Ubuntu backend
without hidden feature loss.

### Tasks

- [ ] Create an API contract fixture for success and error responses.
- [ ] Implement and test every `src/utils/api.js` method:

  - [ ] Authentication and account management
  - [ ] Household creation, switching, membership, invitations, and roles
  - [ ] Trip create/read/update/delete and bulk delete
  - [ ] Journey create/read/update/delete and share/revoke
  - [ ] Traveler create/read/update/deactivate/delete
  - [ ] Photo upload/list/update/delete/reorder and cover selection
  - [ ] Location metadata suggestions and location backfill
  - [ ] Places search and caching
  - [ ] Analytics
  - [ ] Backup status and operator actions
  - [ ] Operations/status information
  - [ ] Export/import safety-net workflows

- [ ] Remove the generic migration-cutover `503` response only after every edit
      path has an explicit implementation or intentional product decision.
- [ ] Add schema versioning to API responses where frontend compatibility may
      span deployments.
- [ ] Add idempotency to create, upload finalization, invitation, email, and
      destructive requests. Retry-safe upload IDs and critical household,
      trip, journey, traveler, invitation, share, revoke, and delete requests
      now have persisted request keys; email, upload-session finalization, and
      queued destructive-operation coverage remain open.
- [ ] Preserve user-friendly offline/network errors while making offline writes
      replay-safe and conflict-aware.

### Exit gate

- [ ] The same browser contract suite passes against both the Ubuntu baseline
      and Cloudflare staging, except for documented intentional changes.

## Phase 5 — Private, scalable photo pipeline

**Purpose:** Preserve photo intelligence while removing dependence on the Ubuntu
filesystem and synchronous `sharp` processing.

### Data model

- [ ] Add explicit photo processing status: `pending_upload`, `uploaded`,
      `processing`, `ready`, `processing_failed`, `quarantined`, `deleted`.
- [ ] Store original/display/thumbnail keys, MIME type, dimensions, byte size,
      checksum, captured date, GPS, orientation, processing version, and error
      code separately.
- [ ] Store metadata provenance (`exif`, `user`, `geocoder`) so client metadata
      is never confused with trusted server observation.
- [x] Add expiring, household-scoped upload-session records with retry-safe
      idempotency, per-variant upload state, and cleanup of abandoned R2
      objects; asynchronous photo processing remains a separate job mode.

### Upload flow

- [x] Request authenticated upload sessions for one household/trip and upload
      original/display/thumbnail variants through short-lived Worker-scoped
      endpoints; a native R2 presigned URL path remains optional if the final
      hosting ownership model supports it.
- [x] Enforce configurable household quota, file-count limit, per-file size,
      per-day upload bytes, allowed extensions, and declared MIME types.
- [x] Resize supported formats in the browser to bounded display and thumbnail
      variants; preserve the original only when product policy allows it.
- [x] Upload files in bounded five-photo requests rather than one request
      containing 50 full-size files; direct R2 upload sessions and resumable
      progress remain future work.
- [ ] Prefer direct private R2 uploads with short-lived scoped upload permission
      when the selected hosting path supports it safely. Otherwise stream one
      bounded object per Worker request.
- [x] Finalize through the Worker; verify object existence, expected key prefix,
      size, checksum where supplied, ownership, and upload-session state before
      creating a photo record.
- [x] Delete expired/unfinalized session objects with a scheduled cleanup job.
- [ ] Treat file names and client MIME types as untrusted display metadata.
- [x] Serve private media only after authorization, using short-lived signed
      delivery or an authenticated Worker route with private/no-store caching.
- [x] Shared-journey media must require a valid scoped share token and must not
      expose unrelated objects or reusable private keys.
- [x] Set safe `Content-Type`, `Content-Disposition`, nosniff, caching, CSP,
      framing, referrer, permissions, and transport headers.

### Photo intelligence

- [ ] Keep browser `exifr` extraction for dates/GPS as a responsive first pass.
- [ ] Preserve the existing clustering algorithm behind a pure, tested module
      that can run in browser or background processing.
- [x] Replace long-running in-request location backfill with a persistent,
      household-scoped, cursor-based job and bounded rate-aware drain; the
      in-memory cache remains only an opportunistic per-isolate L1 cache.
- [ ] Define the HEIC/HEIF path explicitly. If the browser cannot decode it,
      retain the original privately and queue it for the configured processor;
      show the user the processing state.
- [x] Introduce a `PhotoProcessor` interface with a browser implementation now;
      a queued service/Cloudflare Images/container adapter remains a later mode.
- [ ] Never require `sharp`, a writable filesystem, or PostgreSQL inside the
      Worker request path.

### Default beta guardrails

Make these environment-configurable and review them against actual R2 usage:

- [x] Invite-only accounts
- [x] 1 GB initial storage allowance per household
- [x] 20 MB maximum accepted original
- [x] 50 selected photos per user action, uploaded in bounded individual batches
- [x] Upload quota reservations are persisted briefly in D1 so bounded
      concurrent requests cannot bypass household or daily limits; the browser
      still defaults to sequential five-photo batches until direct upload
      sessions are selected.
- [x] No video during the first beta
- [x] Show a warning at 70% and block uploads at 100% of the household storage quota

### Exit gate

- [ ] JPEG, PNG, WebP, rotated images, missing EXIF, GPS EXIF, duplicate upload,
      interrupted upload, HEIC fallback, quota rejection, deletion, private
      delivery, and shared delivery all pass automated and device tests.

## Phase 6 — Jobs, backups, restoration, and deletion

**Purpose:** Make slow work retryable and prove that family data can be recovered.

### Tasks

- [x] Add a persistent jobs/outbox table with type, payload reference, status,
      attempts, next-attempt time, lease, idempotency key, and last error.
- [x] Process jobs through a bounded scheduled drain fallback for the beta; keep
      the queue/workflow adapter open for later scale.
- [x] Move household location backfill/geocoding batches out of interactive
      requests; email retries, photo processing, orphan cleanup, exports, and
      backup-manifest execution remain open.
- [x] Remove the forced full backup after every photo upload.
- [ ] Use D1 Time Travel as one recovery layer, not the only backup.
- [x] Create scheduled versioned database exports with schema version,
      checksums, table counts, and a manifest through the Worker backup path.
- [x] Back up R2 through incremental manifests/copies instead of scanning and
      recopying the entire media library per upload.
- [x] Keep backups logically separated from live media under the `_backups/`
      prefix; independent credential protection and bucket/account separation
      remain open operational decisions.
- [ ] Add an encrypted off-account or off-provider copy before calling the
      archive durable at larger scale.
- [ ] Define retention for sessions, auth attempts, reset tokens, invitations,
      job history, audit events, soft-deleted records, and backups.
- [x] Implement household export jobs with observable progress, bounded R2
      media copying, private manifest/media download routes, idempotent
      requests, and automatic artifact retention cleanup. Implement a bounded,
      backup-first household deletion job with progress, write locking, queued
      job retirement, and fail-closed default behavior; enabling it remains a
      separate destructive-policy gate.
- [ ] Run a clean-room restore into new D1/R2 staging resources and compare
      counts/checksums before sign-off.

### Exit gate

- [ ] A documented restore drill recreates a working household, including
      private photos, without reading from the live database or live media keys.

## Phase 7 — Performance and cost controls

**Purpose:** Keep the beta responsive and prevent success or abuse from creating
an outage.

### Tasks

- [ ] Establish performance budgets for initial page load, API p95 latency,
      upload finalization, timeline load, and photo gallery load. The initial
      read-only staging baseline uses a 1,000 ms p95 budget for shell, health,
      unauthenticated auth, and migration-guard requests; authenticated page,
      upload, and device budgets remain separate follow-up measurements.
- [ ] Add cursor pagination and bounded response sizes everywhere.
- [x] Cache public static assets aggressively with content hashes; hashed
      assets use immutable caching and the HTML shell revalidates frequently.
- [ ] Keep authenticated/private API responses non-cacheable unless the cache
      key and invalidation are proven tenant-safe.
- [x] Add an indexed, bounded D1-backed provider cache shared across Worker
      instances for Places and reverse-geocoder results; memory remains only
      the fast per-isolate layer.
- [ ] Replace full-dataset analytics with bounded aggregate queries or maintained
      summary tables when measurements justify it. Analytics now uses a bounded
      5,000-trip window and reports whether the result was truncated; aggregate
      summary tables remain a later measurement-driven optimization.
- [ ] Record D1 rows read/written, Worker requests/CPU, R2 storage/operations,
      email volume, and external Places requests.
- [ ] Add daily and monthly usage dashboards plus alerts at 50%, 70%, 85%, and
      95% of plan limits.
- [x] Add environment-controlled feature flags/kill switches for uploads,
      invitations, sharing, Places, and location lookups; expensive background
      jobs remain separately gated by their runner configuration.
- [ ] Define a no-surprise upgrade policy: when to move from free to paid and
      who approves it.
- [ ] Run representative load tests without targeting production or violating
      external-service limits.

### Growth triggers

- [ ] Upgrade Worker capacity before sustained traffic approaches free request or
      CPU ceilings.
- [ ] Upgrade storage before household quotas plus backup overhead approach R2
      free storage.
- [ ] Optimize/index before D1 row scans approach daily limits.
- [ ] Partition by household only after measurements justify it; preserve
      `household_id` as the natural future shard key now.
- [ ] Reevaluate D1 when per-database size, write serialization, query latency,
      operational tooling, or compliance needs become material constraints.

### Exit gate

- [ ] Staging load tests meet budgets, and an alert fires correctly in a safe
      synthetic test.

## Phase 8 — Security, privacy, and operational readiness

**Purpose:** Treat family photos and location history as sensitive data.

### Tasks

- [x] Create a lightweight threat model covering account takeover, cross-tenant
      access, leaked share links, object-key guessing, malicious uploads,
      migration endpoints, credential theft, deletion, and cost abuse.
- [ ] Review every secret and rotate any value that has existed outside the
      intended secret manager.
- [ ] Apply least-privilege resource bindings and API tokens.
- [ ] Add CSP, HSTS, frame restrictions, referrer policy, permissions policy,
      nosniff, and safe CORS behavior.
- [ ] Verify logs never contain passwords, session tokens, reset/share tokens,
      raw photo bytes, unnecessary GPS coordinates, or secret headers.
- [x] Add an append-only audit trail for admin and high-risk actions.
- [ ] Define privacy policy, beta terms, acceptable use, retention, export,
      account deletion, and incident-contact expectations before inviting users
      outside the family.
- [ ] Define operator roles and require separate site-admin authorization.
- [x] Create incident runbooks for auth abuse, data exposure, failed migration,
      lost email access, R2 deletion, D1 corruption, and cost spikes.
- [ ] Perform dependency and application security review before launch.

### Exit gate

- [ ] No critical/high security finding is open, and every incident runbook has
      an owner and a tested first action.

## Phase 9 — Migration rehearsal

**Purpose:** Prove the migration repeatedly before touching production DNS.

### Tasks

- [x] Build an idempotent PostgreSQL-to-D1 export/import tool with explicit
      source-to-target ID mapping.
- [x] Build an idempotent filesystem-to-R2 media migration tool with tenant-
      namespaced target keys, content types, byte sizes, and checksums.
- [x] Do not expose reusable migration endpoints after the migration window; the
      beta endpoint was disabled after import and returned 404.
- [ ] Test migration against a production-shaped redacted copy.
- [ ] Compare every source/target table count and relationship count.
- [ ] Compare every media object count, total bytes, and checksum.
- [ ] Verify random and edge-case records visually in staging.
- [ ] Verify migrated password hashes upgrade safely at login or migrate through
      an approved compatible scheme.
- [ ] Verify active sessions are intentionally invalidated; do not attempt to
      preserve old production sessions silently.
- [ ] Verify share-token retention/revocation policy.
- [ ] Run the complete smoke, contract, tenant, email, photo, export, deletion,
      load, and restore suites after each rehearsal.
- [ ] Time the final migration and write-freeze process.
- [ ] Rehearse rollback before approving cutover.

### Exit gate

- [ ] Two consecutive rehearsals produce matching counts/checksums and pass all
      release tests without manual database repair.

## Phase 10 — Production cutover and rollback window

**Status:** Cutover complete; stabilization window active

**Purpose:** Switch safely with a recoverable source of truth.

### Pre-cutover checklist

- [x] Announce/authorize the beta cutover and keep the Ubuntu origin available
      for rollback.
- [x] Confirm a fresh Ubuntu PostgreSQL dump and photo backup; restore testing
      remains an open operational gate.
- [x] Confirm staging/beta and former production bindings are different
      resources.
- [ ] Confirm production secrets, email domain, quotas, logs, and alerts.
- [x] Confirm Cloudflare route and DNS changes are documented and reversible.
- [x] Confirm the exact production deployment: Worker version
      `79cf0a49-b826-46f5-a767-f57a35467a59`.
- [x] Confirm the named go/no-go owner: Yancmo.
- [x] Capture the final source inventory; Ubuntu remains retained for rollback.
- [x] Verify the imported D1/R2 counts and media bytes.

### Cutover checklist

- [x] Deploy the verified immutable build to the direct Worker.
- [x] Route `postcardsofus.com` to the direct Worker and remove the former
      Sites custom-domain attachment.
- [x] Confirm the live hostname uses the intended Worker, D1, and R2 IDs via
      live health and security-boundary checks.
- [ ] Run the full authenticated workflow suite; public cutover smoke tests
      passed, while email, sharing, and device-specific checks remain open.
- [ ] Confirm Worker, D1, R2, email, and error dashboards receive live data;
      email/observability setup remains open.
- [x] Retire Ubuntu from the active route and retain its source/backups for
      rollback; do not reopen two writable production systems.

### Rollback conditions

Rollback immediately for:

- [ ] Any cross-household data or media exposure
- [ ] Missing/corrupted migrated data
- [ ] Widespread login/session failure
- [ ] Uploads that report success without durable retrievable objects
- [ ] Unbounded errors, cost growth, or inability to observe production

### Rollback procedure

- [ ] Stop Cloudflare writes.
- [ ] Preserve Cloudflare logs and export any writes accepted after cutover.
- [ ] With explicit owner approval, reverse the direct Worker custom-domain
      attachment and restore the former route or a reviewed Ubuntu origin.
- [ ] Reconcile post-cutover writes deliberately before reopening Ubuntu writes.
- [ ] Do not run an unreviewed reverse import into PostgreSQL.

### Stabilization window

- [ ] Review errors and usage daily for the first week.
- [ ] Run backup verification daily and one clean-room restore during the window.
- [x] Keep Ubuntu and its final immutable backup available for at least the
      rollback window; the exact retention period remains an operational task.
- [ ] Retire the Ubuntu app only after the rollback window closes and the owner
      signs off. Preserve required archival backups.

## Phase 11 — Post-beta scaling roadmap

Do not implement these solely because they might be useful. Implement when
metrics or product requirements cross a recorded trigger.

- [ ] Paid Worker capacity when request/CPU headroom becomes unsafe.
- [ ] Managed asynchronous image processor when browser processing and beta
      fallback no longer meet format, quality, or reliability needs.
- [ ] Search index when indexed D1 search no longer meets relevance or latency.
- [ ] Per-household database partitioning when database size/write contention
      justifies the operational cost.
- [ ] Dedicated relational database when D1 limits, reporting, compliance, or
      operational needs outweigh its simplicity.
- [ ] CDN delivery strategy for share-approved media at high read volume.
- [ ] Multi-region resilience and disaster recovery objectives when downtime has
      contractual or significant customer impact.
- [ ] Formal support, moderation, abuse response, billing, and subscription
      systems before open public signup.

## 5. Required automated test inventory

### Product behavior

- [ ] Landing, PWA installation, login/logout, session expiry
- [ ] Household creation/switching and role behavior
- [ ] Invitations, verification, recovery, and password change
- [ ] Journey, memory, traveler, and photo CRUD
- [ ] Timeline, search, analytics, People, Cleanup, and Operations
- [ ] Shared journey creation, viewing, expiration, and revocation
- [ ] Export, deletion, backup, and restore

### Security

- [ ] Cross-household read/write/delete attempts for every resource
- [ ] Direct media-key guessing and shared-link scope
- [ ] CSRF, CORS, method, content-type, and oversized-body rejection
- [ ] Session fixation/revocation and token expiry
- [ ] Brute-force and invitation/reset abuse limits
- [ ] Migration/admin endpoint denial in normal production mode

### Photos

- [ ] JPEG, PNG, WebP, HEIC/HEIF fallback, invalid file, renamed executable
- [ ] Orientation, EXIF date/GPS, missing/corrupt EXIF
- [ ] Original/display/thumbnail distinction and dimensions
- [ ] Duplicate, retry, interruption, orphan cleanup, quota, deletion
- [ ] iOS Safari and Android Chrome upload behavior

### Data and operations

- [ ] Migration idempotency and relationship preservation
- [ ] Counts/checksums and restore into empty resources
- [ ] Pagination boundaries and query plans
- [ ] Job retry, duplicate delivery, poison job, and dead-letter handling
- [ ] Alert and feature-kill-switch tests
- [ ] Load tests at expected beta traffic plus a documented safety margin

## 6. Luna implementation rules

- Work phase by phase; do not combine cutover with feature development.
- Keep at most one phase marked in progress in the project tracker.
- Update this document as facts change; do not silently deviate from a decision.
- Use generated, reviewed D1 migrations for schema changes.
- Never edit production D1 manually without recording the exact statement,
  reason, backup point, and verification.
- Never store secrets, private endpoints, personal data, or raw production
  exports in git or planning notes.
- Preserve unrelated user changes in the worktree.
- Use staging resources for destructive, migration, restore, and load tests.
- Deploy immutable builds and record the commit associated with each deployment.
- Every phase handoff must include: changed files, migration files, tests run,
  known risks, screenshots only where visual behavior changed, and open tasks.
- Stop and escalate rather than guessing if account ownership, target resources,
  source-of-truth status, or destructive migration scope is unclear.

## 7. Master progress checklist

- [x] Phase 0 — Ownership, inventory, and baseline
- [ ] Phase 1 — Worker structure and quality gates
- [ ] Phase 2 — Database model and tenant isolation
- [ ] Phase 3 — Authentication and abuse prevention
- [ ] Phase 4 — Complete API parity
- [ ] Phase 5 — Private scalable photo pipeline
- [ ] Phase 6 — Jobs, backups, restoration, and deletion
- [ ] Phase 7 — Performance and cost controls
- [ ] Phase 8 — Security, privacy, and operations
- [ ] Phase 9 — Two successful migration rehearsals
- [ ] Phase 10 — Production cutover and rollback window (cutover complete; stabilization open)
- [ ] Phase 11 — Metric-triggered post-beta scaling

## 8. Final production acceptance checklist

- [x] Ownership and billing boundary is recorded in the intended account.
- [x] No live route depends on Ubuntu.
- [ ] API parity is complete.
- [ ] Tenant-isolation suite is complete and passing.
- [ ] Private media cannot be fetched without authorized context.
- [ ] Photo variants and HEIC fallback are correct.
- [ ] Auth, invitations, password recovery, and email pass end to end.
- [ ] Quotas, rate limits, logs, alerts, and kill switches are active.
- [x] Migration counts and media checksums match.
- [ ] Clean-room restore passed.
- [ ] Load/performance budgets passed.
- [ ] Security review has no open critical/high findings.
- [ ] Cutover and rollback were rehearsed.
- [ ] Production smoke tests passed on desktop, iPhone, and Android.
- [x] Ubuntu is retired as an active origin and retained for rollback; enforce
      host-level write freeze/read-only controls as an operations follow-up.

## 9. Implementation log

### 2026-08-03 — Initial migration hardening pass

- Confirmed through the Sites control plane that `postcardsofus.com` is already
  published from the Sites-managed Worker `yancmo--postcards-of-us`; no first-
  time DNS cutover is currently needed.
- Recorded the live Sites version and source commit in
  `CLOUDFLARE_DEPLOYMENT_INVENTORY.md`.
- Recorded Ubuntu legacy source counts and backup evidence.
- Added `CLOUDFLARE_MIGRATION_QUESTIONS.md`, ADR-005, the API parity matrix, and
  the environment matrix.
- Added household-scoped media key helpers and tests.
- Changed private media delivery to require an authenticated household session;
  shared media requires the exact valid share token.
- Added Worker parity for traveler mutations, journey CRUD, trip bulk delete,
  photo update/delete/reorder, and Google Places search with cache/rate limit.
- Replaced the D1 auth/place rate-limit read-then-write sequence with an atomic
  batch/update pattern.
- Stopped triggering a forced full backup after every successful upload.
- Added photo processing columns and a durable jobs table through generated
  migration `drizzle/0003_fantastic_wolfsbane.sql`.
- Added browser display/thumbnail generation for supported images, explicit
  variant-index mapping for unsupported formats, household storage quotas, and
  bounded five-photo client upload batches.
- Added bounded location backfill with household scope, provider caching, and
  rate limiting; added a retryable jobs lease/drain boundary and scheduled hook
  for media cleanup and future backup jobs.
- Converted location backfill from synchronous provider calls to a
  household-scoped persistent job with a bounded trip-id cursor, idempotent
  continuation jobs, retry-on-provider-failure behavior, and a 202 client
  contract. Added the `jobs.household_id` index and work-planner tests.
- Added the browser `PhotoProcessor` implementation behind a replaceable
  processor boundary; unsupported HEIC/HEIF remains visibly pending until a
  queued processor mode is selected.
- Added the `provider_cache` D1 table and bounded provider cache layer so
  Google Places and reverse-geocoding results can be reused across Worker
  isolates instead of relying only on per-isolate memory.
- Rotated cookie sessions after password changes, household creation/switching,
  and invitation acceptance; password changes now revoke all older sessions.
- Added fail-closed kill switches for migration endpoints and the external
  backup runner; a secret alone no longer exposes either maintenance surface.
- Added a migration-backed local D1/R2-compatible harness and an integration
  test proving cookie household switching rotates the session and rejects the
  stale cookie against the same SQLite schema used by the Worker.
- Added a tenant-boundary integration assertion for traveler filtering, even
  when a deliberately inconsistent cross-household link exists in the test DB.
- Wired the Worker scheduled handler to run the bounded job drain and invoke
  the versioned backup path on its age gate, with an automatic-backup kill
  switch for operations.
- Added a local clean-room backup/restore integration test that rebuilds a new
  D1 schema and R2 namespace, restores database rows and archived media, and
  verifies table counts and private photo bytes; the isolated staging restore
  evidence is recorded in the migration inventory and smoke log.
- Added migration `drizzle/0008_overrated_may_parker.sql` and persisted,
  household-scoped idempotency records for critical create/invitation routes;
  duplicate request bodies replay the original response and key reuse with
  different data is rejected.
- Extended persisted idempotency protection to bulk trip deletion, single trip
  deletion, journey/traveler deletion, sharing, revocation, and photo deletion,
  including replay-safe cleanup responses; a durable email outbox remains an
  owner decision for external beta use.
- Added bounded three-attempt Resend delivery retries with stable provider
  idempotency keys and tests that simulate transient provider failures without
  logging message bodies or tokens.
- Added the D1-backed `upload_reservations` table and generated migration
  `drizzle/0009_brief_riptide.sql`; short-lived reservations make storage and
  daily upload quotas enforceable across concurrent requests. Browser upload
  attempts now carry a stable reservation token across retries, and scheduled
  cleanup removes expired reservations.
- Added generated migration `drizzle/0010_small_proudstar.sql` with optional
  authenticated photo upload sessions. Original, display, and thumbnail
  objects now have per-variant size/checksum verification and Worker-side
  finalization; expired sessions remove abandoned R2 objects. The browser
  adapter is available behind `VITE_USE_UPLOAD_SESSIONS` and remains disabled
  until staging/device validation is complete.
- Added generated migration `drizzle/0011_ambiguous_bulldozer.sql` with
  household/date and household/trip/gallery composite indexes, plus a query
  plan regression that confirms representative list queries use indexed access.
- Added generated migration `drizzle/0012_tidy_norrin_radd.sql` for household
  export operation state. Owner/admin export requests now enqueue bounded R2
  copy jobs, expose progress and private download routes, and expire exported
  artifacts after seven days; local integration coverage verifies media bytes
  and omission of raw source keys from the downloaded manifest.
- Added generated migration `drizzle/0013_puzzling_scarecrow.sql` for
  household deletion operation state. Deletion requests are owner/admin-only,
  exact-name-confirmed, idempotent, backup-first, progress-tracked, and
  fail-closed behind `ENABLE_HOUSEHOLD_DELETION=false`; active deletions lock
  household writes, bounded jobs remove tenant media and export artifacts, and
  the worker retires household jobs before removing the household row to remain
  compatible with the existing D1 foreign-key behavior.
- Added scheduled cleanup for expired idempotency keys, provider-cache entries,
  sessions, reset/verification tokens, and auth-rate-limit rows, with a test
  proving live cache state is retained.
- Moved Photo Intelligence off the Ubuntu-only analyzer/temp-file endpoints into
  browser EXIF parsing, pure clustering, browser previews, and normal Worker
  trip/photo APIs; added clustering tests.
- Added read-only legacy export, checksum-verified migration preparation, and
  guarded import scripts with household-scoped R2 keys; tightened the Worker
  migration media endpoint to reject backup/arbitrary keys.
- Added a non-deploying Cloudflare preflight gate and CSRF checks for
  cookie-authenticated state-changing requests.
- Added retry-safe photo uploads with `client_upload_id`, deterministic media
  keys, generated migration `drizzle/0004_nice_psylocke.sql`, and coverage for
  migration preparation and checksum validation.
- Added account session-security controls so a signed-in user can revoke other
  sessions or sign out everywhere; the Worker exposes household-scoped session
  metadata without returning session secrets.
- Added reversible runtime kill switches for uploads, invitations, sharing,
  Places, and location lookups; disabled features return a retryable 503 without
  exposing configuration details.
- Enforced the 50-photo client action cap plus optional household daily upload
  count and byte limits in the Worker; retry IDs remain excluded from new-use
  quota calculations.
- Added the append-only `audit_events` table and generated migration
  `drizzle/0005_nappy_silvermane.sql`; high-risk account, household, invite,
  share, delete, and manual-backup actions now record non-secret event metadata.
- Added dedicated rate limits for invite-account creation and password-reset
  submission attempts in addition to login and reset-email request limits.
- Made legacy browser bearer-token storage an explicit opt-in build flag;
  Cloudflare builds default to cookie-only authentication and clear any token
  returned by a legacy-compatible login when the flag is off.
- Corrected the pending-photo media contract so `thumbnail_path` is null until
  a real processed thumbnail exists; added a regression test and UI placeholders
  for pending/failed processing records.
- Changed analytics to use a trip/traveler-only query path instead of decorating
  every trip with its complete photo collection.
- Added backward-compatible cursor pagination for `/api/trips` and
  `/api/photos/:tripId`, plus client page methods; legacy array responses remain
  unchanged until the UI is moved to bounded loading.
- Switched `DataContext` trip loading and the photo gallery modal to aggregate
  bounded cursor pages, so current screens no longer request unbounded trip or
  photo responses.
- Added bounded cursor pages for journeys and changed the current journey screen
  to aggregate them; journey detail/shared reads now decorate only the selected
  journey’s memories and photos.
- Added versioned R2 media manifests and reuse checks so unchanged objects are
  not recopied into each backup; changed objects receive a new archive version,
  while prior archives preserve deleted-source recovery points.
- Added SHA-256 metadata to backup database/media manifests and total media-byte
  reporting to migration status; fresh migration targets now verify counts and
  bytes against the prepared checksummed artifact.
- Added a household quota endpoint and uploader warning at 70%; server-side
  storage and daily upload limits remain authoritative at 100%/limit breach.
- Added `CLOUDFLARE_THREAT_MODEL.md` and
  `CLOUDFLARE_INCIDENT_RUNBOOK.md` with current controls, kill switches,
  evidence-preservation steps, and explicit open owner actions.
- Hardened the migration importer to reject non-empty targets by default and to
  verify post-import table counts against the prepared artifact.
- Ran the read-only Ubuntu export and household preparation rehearsal in
  temporary remote directories: source counts and checksums were generated;
  112 referenced media objects are prepared, while 13 unreferenced files are
  explicitly held for the orphan-media decision in the questions file.
- Final local validation for this pass: 24 automated tests passed, the Vite
  Worker/static build passed, generated migration state is clean,
  `npm run preflight` passed, and `git diff --check` is clean. No Sites version
  was saved or deployed.

The earlier entries in this log document pre-cutover work and did not
constitute production approval at that time. The later cutover entry records
the owner-authorized production change. Native presigned/direct-R2
optimization, device/HEIC processing validation, full incremental backups,
email delivery, broad authenticated workflow coverage, load testing, and
rollback rehearsal remain open gates for a larger public launch.

### 2026-08-03 — Direct beta deployment and import

- Created isolated account resources: Worker `travel-journal`, D1
  `postcards-of-us-beta-db`, and private R2 `postcards-of-us-beta-media`.
- Applied all 14 generated D1 migrations through `0013_puzzling_scarecrow.sql`.
- Deployed the Worker with `DB`, `MEDIA`, and `ASSETS` bindings plus the
  existing beta guardrails and a 15-minute scheduled trigger.
- Exported Ubuntu read-only data, prepared household-scoped artifacts, and
  uploaded 112 media objects after source checksum/size verification.
- Imported 1 household, 2 users, 2 memberships, 12 travelers, 3 journeys, 96
  trips, 158 links, and 41 photos. The target contained 112 media objects
  totaling `72,274,558` bytes.
- Disabled the migration endpoints and verified `/api/migration/status` returns
  `404`; `/api/health` returns `200` with database/storage connected and
  `empty:false`; unauthenticated `/api/auth/me` returns `401`.
- No custom domain, DNS route, existing Sites binding, backup bucket, or Ubuntu
  data was changed.

### 2026-08-03 — Legacy username login compatibility

- Found that the legacy Ubuntu `users` table stored `yancmo` as a username and
  had no email column, so the imported account initially had no email address.
- Added a guarded beta login bridge: the email local-part can identify an
  imported account with a null email, and the supplied address is saved only
  after the existing password hash verifies.
- Corrected the frontend so failed login credentials report the server’s
  `Invalid email or password` response instead of incorrectly saying the
  session expired.
- Added a regression test; 25 tests pass, the build passes, and the fix is
  deployed to `travel-journal.yancmo.workers.dev`.

### 2026-08-03 — GitHub issue triage before beta testing

- Reviewed open issues #16 and #17 in `yancmo1/travel-journal`.
- Addressed issue #16 in the beta: trip deletion no longer forces a full
  backup for every request, and disabled location-backfill checks return a
  quiet empty result instead of repeated `503` responses. The beta manifest
  returns `200`; the older Sites production manifest still returns `401` and
  remains an explicit production publishing/access-control gate.
- Responded to issue #17 with a recommendation for explicit household/photo
  opt-in, public-safe derivatives, EXIF stripping, immediate revocation, and
  moderation/takedown policy before any featured-photo feature is enabled.

### 2026-08-03 — Live beta domain cutover

- Owner-authorized the direct Cloudflare Worker beta as the live production
  beta for `postcardsofus.com`.
- Removed the two former root A records from the Cloudflare zone, attached the
  root custom domain to Worker `travel-journal` Production, and retained the
  verification TXT records.
- Removed the former Sites project custom-domain attachment from
  `yancmo--postcards-of-us`; the Sites project, version history, and Ubuntu
  source/backups remain available for rollback history.
- Verified the live root hostname: homepage `200`, `/api/health` `200` with
  database/storage/schema ready and `empty:false`, manifest `200` with
  `application/manifest+json`, unauthenticated `/api/auth/me` `401`, and
  `/api/migration/status` `404`.
- Recorded Ubuntu as retired from the active route. No destructive server
  shutdown or source-data deletion was performed; the old environment remains
  a rollback archive until the documented window closes.

### 2026-08-03 — Tenant-boundary hardening and production patch

- Added `test/worker-route-contract.test.js` covering authenticated route
  shapes, method rejection, request/security headers, cross-household numeric
  IDs, private media, and operator-only maintenance access.
- Fixed journey updates to check household ownership before validating or
  applying input, and fixed photo reorders to return a non-disclosing 404 for
  an unknown household trip.
- Fixed bulk trip deletion to reject any mixed-household or missing-ID batch
  before mutating anything; the test proves both the 404 response and that all
  records remain intact.
- Local validation passed: 27 tests, production build, and deployment
  preflight.
- Deployed the fix to Worker version
  `79cf0a49-b826-46f5-a767-f57a35467a59`, then rechecked the live root: homepage
  `200`, health `200`, manifest `200`, unauthenticated auth `401`, and disabled
  migration status `404`.

### 2026-08-03 — Isolated staging restore verification

- Created separate staging Worker `travel-journal-staging`, D1
  `postcards-of-us-staging-db` (`99f58f09-2bd0-49ec-aec5-9e290af239c3`), and
  private R2 `postcards-of-us-staging-media`; the staging deployment is
  `2ddf5e9d-6986-45d8-aa21-bef81052e75f`.
- Applied all 14 migrations and configured a separate random `JWT_SECRET`.
- Restored the production D1 snapshot read-only into staging. All 21
  application table counts matched: 2 users, 1 household, 2 memberships, 13
  travelers, 4 journeys, 92 trips, 155 trip-traveler links, 41 photos, 2
  sessions, 5 audit events, 7 idempotency keys, and zero rows in the remaining
  auxiliary tables.
- Verified all 112 referenced private R2 keys in staging after retrying an
  incomplete first transfer; no production resources were modified.
- Staging `/api/health` returned `200` with database, storage, and schema ready
  and `empty:false`. The clean-room restore evidence gate is now satisfied for
  this current snapshot; full authenticated, device, load, and recovery tests
  remain open.

### 2026-08-03 — Recovery snapshot coverage hardening

- Expanded the Worker backup snapshot to include durable export and deletion
  operation state, while explicitly excluding sessions, password/reset and
  verification tokens, rate limits, and upload reservations as ephemeral
  security/runtime state.
- Extended the local restore integration test to insert and restore both
  operation records, proving the expanded backup contract.
- Local validation passed: 27 tests, production build, and deployment
  preflight.
- Deployed Worker version `3ed36836-237f-4d90-be68-5592bab64196` and verified
  the live root health `200`, unauthenticated auth `401`, and disabled
  migration status `404`.

### 2026-08-03 — Static delivery cache policy

- Added Cloudflare static-assets `_headers` rules: fingerprinted `/assets/*`
  files use one-year immutable browser/edge caching, while the HTML shell
  revalidates every 60 seconds.
- Added preflight checks that require the built `_headers` file and its
  immutable asset rule; added a Worker-level cache-policy regression test.
- Local validation passed: 28 tests, production build, and deployment
  preflight.
- Deployed production Worker `8b80ff28-6f42-460c-a6dd-095f2b457ca9` and
  staging Worker `734c6945-6b25-4f21-9ff3-5ee9284d97d5`. Live checks showed
  `CF-Cache-Status: HIT` and immutable caching for the hashed JavaScript asset;
  production and staging health remained ready.

### 2026-08-03 — Native sampled Worker observability

- Enabled Cloudflare Workers Logs for production and staging with a 10% head
  sampling rate in both Wrangler configurations.
- Deployed production Worker `d2099166-23cf-4f04-a674-68581445e4ed` and
  staging Worker `4cbde08c-db5e-4ec8-b9d3-5bc7d0d82b47`; deployments completed
  successfully and both environments retained their health/guard behavior.
- The sampling rate is deliberately bounded for the beta; review event volume
  and retention before increasing it or enabling trace sampling.

### 2026-08-03 — Invitation registration retry safety

- Added persisted idempotency handling to invited-account creation and generated
  the client idempotency key for invitation registration requests.
- Replays return the original successful response after the invitation has been
  marked accepted; invalid/expired/invalid-input paths release their claim.
- Added an integration regression test covering replay, duplicate prevention,
  and household membership count.
- Local validation passed: 29 tests, production build, and deployment
  preflight.
- Deployed production Worker `f5c8e289-c0ec-4553-b3f5-60d0b487d419` and
  staging Worker `1def7bd5-32cf-49f5-852d-a0c88e1f8285`; health remained ready
  and production auth/migration guards remained `401`/`404`.

### 2026-08-03 — Multipart photo checksum parity

- Added SHA-256 calculation and R2 custom metadata for original, display, and
  thumbnail objects in the normal multipart upload path.
- Persisted the original checksum in the photo record so normal uploads and
  authenticated upload sessions now expose the same recovery-verification
  primitive.
- Added an integration assertion that the D1 checksum matches the R2 object
  metadata.
- Local validation passed: 29 tests, production build, and deployment
  preflight.
- Deployed production Worker `d52e2eb4-f860-4a51-b2ec-024cf3f872f1` and
  staging Worker `d5ac1bc6-345f-4a93-b61c-0c4c0d53fd2f`; health remained ready
  and production guards remained `401`/`404`.

### 2026-08-03 — Upload-session checksum parity

- Persisted verified SHA-256 checksums for each upload-session variant and
  carried the original checksum into the finalized `photos` row.
- Added integration coverage proving the finalized D1 checksum matches the
  original private R2 object's `sha256` metadata.
- Local validation passed: 29 tests, production build, deployment preflight,
  and `git diff --check`.
- Deployed production Worker `1d4b58f3-c6a5-4113-87bc-62110bfb70d8` and
  staging Worker `2d166c2d-e9fb-4c22-b922-6659d4cb575a`; health remained ready
  and production guards remained `401`/`404`.

### 2026-08-03 — Remote capacity baseline

- Recorded a read-only Wrangler inventory of both D1 databases and R2 buckets
  in `CLOUDFLARE_DEPLOYMENT_INVENTORY.md`.
- Production currently reports 22 D1 tables, 462,848 bytes, 797 reads and 471
  writes in the prior 24 hours, plus 227 R2 objects totaling 145 MB.
- Staging currently reports 22 D1 tables, 462,848 bytes, 89 reads and 104
  writes in the prior 24 hours, plus 113 R2 objects totaling 72.3 MB.
- Read replication is disabled in both databases. This is acceptable for the
  current beta baseline but remains a documented scaling trigger rather than
  an assumption of large-scale readiness.

### 2026-08-03 — Bounded analytics deployment

- Added a configurable `MAX_ANALYTICS_TRIPS` window, defaulting to 5,000 and
  capped at 20,000, so analytics cannot create an unbounded D1 `IN (...)`
  query or memory response as a household grows.
- Added `analytics_scope` metadata with total, included, and truncation state;
  the current dataset remains untruncated.
- Added route-contract coverage and deployed production Worker
  `2504ccb0-bbe7-4eb3-8ad5-7b0cc4a7cb31` plus staging Worker
  `4d3efa19-fa0d-464b-8731-2fa54b06dae1`.
- Post-deploy health/auth/migration guards remained `200`/`401`/`404`, and the
  staging read-only performance probe passed all 240 requests.

### 2026-08-03 — Production backup artifact verification

- Read the production `_backups/latest.json` manifest without modifying R2.
  The latest successful scheduled snapshot was
  `2026-08-03T13:30:16.856Z` and was not stale under the configured 30-hour
  freshness window.
- Downloaded the database and media-manifest artifacts read-only and verified
  their SHA-256 values against the latest manifest. The media manifest contains
  112 namespaced objects totaling 72,274,558 bytes.
- Recorded the evidence in `CLOUDFLARE_DEPLOYMENT_INVENTORY.md`. This closes
  backup-artifact creation/integrity verification for the current beta snapshot;
  off-account retention, D1 Time Travel policy, and repeatable remote restore
  remain open.

### 2026-08-03 — Photo upload signature validation

- Added Worker-side magic-byte validation for JPEG, PNG, GIF, WebP, and
  HEIC/HEIF originals, plus JPEG validation for generated display and thumbnail
  variants, on both multipart and upload-session paths.
- Added regression coverage proving renamed executable content is rejected and
  supported image signatures are accepted. Browser-undecodable HEIC/HEIF still
  remains explicitly `pending_processing`; no server-side conversion was
  assumed.
- Local validation passed: 31 tests, production build, deployment preflight,
  and `git diff --check`.
- Deployed production Worker `92f0e9f9-d9f7-4f0c-9096-43deb6983bac` and
  staging Worker `b36ad0e7-ccfc-4f94-9a23-9f9831277662`; health/auth/migration
  guards remained `200`/`401`/`404`, and the staging read-only probe passed all
  240 requests.

### 2026-08-03 — Staging browser smoke

- Opened the isolated staging Worker in the browser and verified the landing,
  sign-in, and password-recovery screens at the default viewport and a 390×844
  mobile viewport.
- Confirmed visible headings, email/password controls, sign-in and recovery
  links, invitation-only messaging, and no console-blocking UI failure.
- No credentials were submitted, no recovery email was requested, and no
  production page was used. Authenticated mobile upload and real iOS/Android
  device coverage remain open.

### 2026-08-03 — Password recovery regression coverage

- Added an integration test for the recovery contract: generic forgot-password
  response, email dispatch through the configured provider boundary, token
  consumption, session invalidation, changed-password notification, and login
  with the replacement password.
- Local validation now passes: 30 tests, production build, deployment
  preflight, and `git diff --check`.
- This was a test-only change; no production deployment or email was triggered.

### 2026-08-03 — Staging read-only performance baseline

- Added `scripts/cloudflare-staging-load-test.mjs` and the
  `npm run load:staging` command. It refuses the production hostname by
  default, caps request count/concurrency, performs only GET requests, and
  checks expected security/status responses.
- Ran 60 requests each against staging health, the app shell, unauthenticated
  auth, and the migration guard (240 total; concurrency 6). All 240 responses
  matched their expected status and stayed within the initial 1,000 ms p95
  budget: health 449 ms, shell 179 ms, auth 25 ms, migration guard 29 ms.
- This establishes only an edge/read baseline. Authenticated timeline,
  upload-finalization, photo-gallery, device, and sustained-load budgets remain
  open and are not being inferred from this result.

### 2026-08-03 — Operator email readiness status

- Added a site-admin-only `email` status block to `/api/admin/operations`. It
  reports the provider, sender configuration, and delivery configuration as
  booleans without exposing secret values.
- Verified through the live Wrangler secret inventory that only `JWT_SECRET`
  exists in production and staging; Resend delivery remains intentionally
  unconfigured until the verified sender and API key are supplied.
- Deployed production Worker `c6243e53-0a0f-4d9d-a3c6-bff6e0ce64a3` and staging
  Worker `8ef481d3-35d6-49c2-94c4-1e2092f3536d`; health/auth/migration guards
  remained `200`/`401`/`404`, and the staging read-only probe passed all 240
  requests.

### 2026-08-03 — Invitation acceptance retry safety

- Added persisted idempotency to invitation acceptance and a matching client
  idempotency header. Replaying the same acceptance after the first response
  rotates the session now returns the original success safely instead of being
  treated as a second acceptance.
- Added integration coverage for the post-session-rotation replay path.
- Deployed production Worker `ee9d0d2a-3fc4-4e14-938c-1d3a2f54689f` and staging
  Worker `0b23ba81-85e8-47c6-a5c7-e57d3c55ad6a`. Both live guards returned
  `200`/`401`/`404`; staging completed 240 read-only requests with zero
  failures and all route p95 values below the 1,000 ms budget.
- Full local validation passed: 32 tests, production build, deployment
  preflight, and `git diff --check`.

### 2026-08-03 — Authenticated staging performance rehearsal

- Added the bounded `npm run load:staging:auth` probe. It requires explicit
  staging credentials, refuses the production hostname by default, sends only
  authenticated GET requests, caps request count/concurrency, and treats a
  normal member's operator-route `403` as the expected authorization result.
- Created a temporary staging-only rehearsal user, household, journey, trip,
  and traveler directly in the isolated staging D1. The fixture was used for
  30 requests each across authentication, household, traveler, journey, trip,
  analytics, and operations routes (210 total), then removed and verified at
  zero remaining users/households.
- All authenticated routes passed with zero failures and p95 latency below the
  1,000 ms initial budget. This is an edge/read rehearsal, not a sustained
  production-capacity claim; uploads, device behavior, email delivery, and
  authenticated production traffic remain open.
- After cleanup, both production and staging again returned the expected
  health/auth/migration guards (`200`/`401`/`404`), the unauthenticated staging
  probe passed all 240 requests, and the 32-test local suite passed.
