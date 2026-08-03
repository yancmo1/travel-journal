# Cloudflare Migration Questions

These questions are intentionally non-blocking where the repository can make
safe progress without an answer. The original cutover-blocker questions are
resolved below by the owner-authorized 2026-08-03 beta cutover; the remaining
questions still govern broader beta operation and future scale.

## Observed beta state (2026-08-03)

- A separate direct Cloudflare beta is now deployed at
  `https://travel-journal.yancmo.workers.dev` in account
  `ed7a3a18b893e8de24e7e0ab063c1c72`.
- Its D1 database is `postcards-of-us-beta-db` and its private R2 bucket is
  `postcards-of-us-beta-media`; neither is the existing Sites production
  binding.
- The Ubuntu dataset was imported into the isolated beta with verified counts
  and media bytes. The migration-only endpoints were disabled immediately
  afterward. The root domain was later attached to the direct Worker after the
  owner authorized the live beta cutover.
- `postcardsofus.com` now routes to the direct Worker; the former Sites custom
  domain was removed, while its project/version history and Ubuntu source are
  retained for rollback.
- Isolated staging is now available at
  `https://travel-journal-staging.yancmo.workers.dev` with separate D1
  `postcards-of-us-staging-db` and private R2 `postcards-of-us-staging-media`.
  Its restored snapshot matched all 21 application table counts and all 112
  referenced private media keys on 2026-08-03.

## Cutover state (2026-08-03)

- **Account/production boundary resolved:** the direct Worker, D1, R2, DNS
  zone, and custom-domain route are owned in Cloudflare account
  `ed7a3a18b893e8de24e7e0ab063c1c72`. The former Sites deployment is historical
  rollback context, not the active route.
- **Root hostname resolved:** `https://postcardsofus.com` is live on Worker
  `travel-journal`; `www.postcardsofus.com` remains unconfigured.
- **Go/no-go owner resolved:** Yancmo authorized the cutover on 2026-08-03.
- **Data policy resolved:** the imported Ubuntu dataset is the initial beta
  production dataset; Ubuntu is retired as an active origin and retained for
  rollback.
- **Photo policy resolved:** imported originals and generated display/thumbnail
  objects are retained in private R2; 13 unreferenced source files remain only
  on Ubuntu pending owner review.

## Historical cutover blockers — resolved

1. **Cloudflare ownership (resolved):** Sites confirmed that `postcardsofus.com` was
   published from project `appgprj_6a6e58b91e608191aef8c1102f6b8416` with an
   active custom domain. Is this Sites-managed deployment acceptable as the
   production ownership/billing boundary, or should production move to a
   Cloudflare account you control directly?
2. **Staging hostname (not needed for this cutover):** Which hostname should be used for staging? The plan
   suggests `staging.postcardsofus.com`; confirm that DNS changes are allowed.
3. **Cutover authority (resolved):** Who is the go/no-go person for the final DNS switch,
   and what maintenance window is acceptable?
4. **Data policy (resolved):** Should the existing Ubuntu data be migrated as the initial
   production dataset, or should Cloudflare beta begin with a fresh household
   and retain Ubuntu as the archive?
5. **Photo policy (resolved):** Should originals be retained in R2, or should the beta keep
   only normalized display images and thumbnails after import?

## Important, but non-blocking for local implementation

6. **Email:** Which verified sending domain and sender address should be used for
   invitations and password recovery? Current local configuration references
   `postcards@shepswork.com`.
7. **Places:** Should Google Places remain enabled for beta, with its existing
   budget guardrails, or should the first Cloudflare beta use only the free
   geocoder path?
8. **HEIC:** Is HEIC support required on day one, or is a clear “processing
   pending/not supported yet” state acceptable until an asynchronous processor
   is selected?
9. **Public sharing:** Should shared journeys remain accessible to anyone with
   a valid unexpired link, or require the viewer to sign in?
10. **Beta quotas:** Are the plan defaults acceptable: 1 GB per household,
    20 MB per original, 50 selected photos per action, no video, and invite-only
    accounts?
11. **External login:** Is Google/Apple/Facebook login out of the first
    Cloudflare beta, as the existing TODO suggests?
12. **Location provider:** Is the bounded beta backfill allowed to use
    Nominatim/OpenStreetMap server-side, or should location lookup be disabled
    until a paid/owned provider and usage budget are selected?
13. **Orphan media:** The read-only Ubuntu export contains 125 media files, but
    only 112 are referenced by legacy photo rows. Should the 13 unreferenced
    files be quarantined in a separate R2 archive, retained only on Ubuntu, or
    excluded after an owner review?
14. **Background runner:** For the selected Cloudflare hosting path, which
    scheduler/cron configuration will invoke the Worker `scheduled` handler,
    and what interval is acceptable for beta jobs such as location backfill and
    media cleanup?
15. **Email retry durability:** Is three-attempt synchronous Resend delivery
    sufficient for beta, or should we add an encrypted D1 email outbox before
    inviting external beta users? The latter needs a separate outbox encryption
    secret and a policy for retaining failed message metadata.
16. **Upload mode:** For staging and beta, should the browser use the new
    authenticated Worker upload sessions, or should we configure native R2
    presigned URLs after the final Cloudflare account/binding owner is known?
    The Worker session adapter is implemented but disabled by default.
17. **Export policy:** Are owner/admin-only household exports with seven-day
    private artifact retention acceptable, or should members be allowed to
    export and/or should retention be shorter or longer?
18. **Deletion policy:** What maintenance window, backup-retention period, and
    confirmation/approval process should govern household deletion? The
    deletion workflow is implemented but remains disabled by default.
19. **Recovery policy:** How many days of in-account R2 snapshots should be
    retained, should D1 Time Travel be enabled as a second recovery layer, and
    where should an independent off-account copy live? The current beta backup
    manifest is verified in R2, but no retention or off-account destination is
    assumed without an owner decision.

## Resolution log

| Question | Decision | Date | Owner |
| --- | --- | --- | --- |
| Beta rehearsal target | Use the separate direct Worker/D1/R2 resources above; keep Sites production and Ubuntu unchanged | 2026-08-03 | Yancmo |
| Production runtime | Use direct Worker `travel-journal` in account `ed7a3a18b893e8de24e7e0ab063c1c72`; retain former Sites project only for rollback history | 2026-08-03 | Yancmo |
| Live hostname | Attach `postcardsofus.com` to the direct Worker; leave `www` unconfigured for this beta | 2026-08-03 | Yancmo |
| Initial dataset | Use the verified imported Ubuntu dataset in beta; retire Ubuntu as the active origin and retain source/backups | 2026-08-03 | Yancmo |
| Media retention | Keep referenced originals, display images, and thumbnails in private R2; retain 13 unreferenced files only on Ubuntu pending review | 2026-08-03 | Yancmo |
