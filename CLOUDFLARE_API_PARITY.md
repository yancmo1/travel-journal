# Cloudflare API Parity Matrix

This matrix compares the browser API client with the Cloudflare Worker. A
Cloudflare cutover cannot proceed while a required client method is missing or
silently returns the migration-cutover `503` response.

| Client capability | Client method(s) | Worker status at Phase 0 | Required action |
| --- | --- | --- | --- |
| Authentication | login, register, getMe, logout | Partial; invite-only Worker behavior differs intentionally; session listing and revoke-other/revoke-all controls added | Document contract and test invite-only behavior, session expiry, and password-change revocation |
| Recovery | forgotPassword, resetPassword, changePassword | Present in Worker; local regression now covers generic recovery response, token consumption, changed-password notification, session invalidation, and replacement-password login | Complete staging email/device/end-to-end coverage and configure verified Resend sender |
| Invitations | getInvitation, registerInvitation, invite, accept | Present in Worker; invited-account creation and invitation acceptance now use persisted idempotency replay, including the session rotation on first acceptance | Test roles, expiry, and email failure; retry/replay coverage is passing |
| Households | get, create, switch, members | Present in Worker | Add role/ownership isolation tests |
| Trips | list, get, create, update, delete, bulk-delete | Implemented in Worker; existing screens now aggregate bounded cursor pages while preserving their array shape; trip creation, single delete, and bulk delete support persisted idempotency replay | Add exact contract and deletion-job tests |
| Journeys | list, create, update, delete, share, revoke, shared view | Implemented in Worker; current screen aggregates bounded journey pages and detail/shared routes are scoped to one journey; journey creation, deletion, share, and revoke support persisted idempotency replay | Add exact contract, role, and deletion tests |
| Travelers | list, create, update, delete | Implemented in Worker; traveler creation and deletion support persisted idempotency replay; role tests still needed | Add exact contract and tenant tests |
| Photos | upload, list, quota, update, delete, reorder | Implemented in Worker; existing gallery now aggregates bounded cursor pages; browser variants, D1-backed quota reservations, optional expiring upload sessions with per-variant finalization, quota visibility/enforcement, bounded batches, retry-safe IDs, queued cleanup, image magic-byte validation, and a replaceable browser processor boundary exist | Add staging/device upload-session and queued processor tests; select a server/browser HEIC conversion policy |
| Photo metadata | inspectPhotoMetadata, suggestions | Browser extraction exists; server path incomplete | Validate metadata and processing provenance |
| Photo intelligence | `PhotoAnalyzerPage` analyze and create-from-analysis requests | Implemented in browser with EXIF parsing, pure clustering, browser previews, normal trip creation, and normal photo uploads | Add device coverage and decide whether future server-side HEIC processing is required |
| Location backfill | get candidates, run backfill | Implemented in Worker with household scope, bounded cursor pages, idempotent persistent jobs, scheduled drain, opportunistic cache, and rate limit | Add exact route/provider contract tests and a durable provider-cache policy |
| Places | searchPlaces and browser reverse lookup | Implemented in Worker with bounded D1-backed cache plus per-isolate fast cache, provider failure handling, and rate limits; browser fallback preserves legacy compatibility | Add provider budget and cache route tests |
| Analytics | getAnalytics | Present; now reads trip/traveler fields without loading photo collections and enforces a configurable 5,000-trip window with explicit truncation metadata | Replace the bounded scan with maintained aggregate summaries when measurements justify it |
| Backup status | getBackupStatus, runBackup | Present; versioned R2 media manifests now reuse unchanged archive copies, while D1 snapshots and restore drills remain open | Add incremental D1 export and restore tests |
| Operations | getOperations | Present in Worker | Add observability and safe operator controls |
| Export/import | DataBackupPanel flows | Browser metadata safety-net exists; versioned migration export/prepare/import scripts now produce checksummed household-scoped artifacts and fresh-target byte/count verification; authenticated household export jobs now copy media in bounded batches and expose progress/download routes; backup-first household deletion is implemented as a disabled-by-default bounded job with write locking | Add staging export/deletion and clean-room restore rehearsal; resolve deletion policy before enabling |
| Offline behavior | offline store and retry behavior | Browser-only; replay semantics unspecified | Add idempotency and conflict policy |

## Parity acceptance

- [ ] Every row has a tested Worker endpoint or an approved product change.
- [ ] Success and error response shapes are documented.
- [ ] Authorization and tenant tests exist for every write and media route;
  the local D1/R2 harness now proves cookie household-switch isolation,
  private-media rejection, route contracts, and mixed-household bulk-delete
  atomicity; full route coverage remains open.
- [ ] Pagination and bounded response behavior are tested end to end; cursor helpers and the location-backfill work planner are covered locally, while full route contracts remain open.
- [ ] The client can switch between Ubuntu and Cloudflare staging using only the
      API base URL and compatible auth behavior.
