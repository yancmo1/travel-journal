# Postcards of Us Cloudflare Beta Threat Model

**Scope:** Cloudflare Worker, D1, R2, browser client, transactional email,
migration tooling, and the retained Ubuntu rollback source.

## Risk register

| Threat | Impact | Current control | Remaining verification/action |
| --- | --- | --- | --- |
| Account takeover or password spraying | Private family data exposed | Invite-only registration, PBKDF2/bcrypt verification, atomic rate limits, reset/register abuse limits, secure cookie sessions, session revocation UI | Staging auth abuse tests; verify sender-domain protections |
| Cross-household record access | Memories, people, or locations exposed | Household predicates on Worker reads/writes; private media checks authorization before R2 reads; household-scoped R2 keys | Complete every-route tenant matrix against staging |
| Leaked journey/share link | Deliberate shared content exposed beyond intended recipients | High-entropy scoped token, expiry support, revoke endpoint, shared media checks journey membership | Confirm product policy: link-only access versus viewer sign-in |
| Object-key guessing or backup traversal | Private media or archives exposed | Safe key validation, household prefixes, backup prefix rejection, authenticated/no-store private delivery | Verify R2 bucket access has no public bypass |
| Malicious or oversized upload | Worker failure, storage exhaustion, cost spike | Type/size/file-count checks, image magic-byte validation, 50-photo action cap, storage/daily quotas, 70% warning, upload kill switch, browser variants | Add device tests; select HEIC processor |
| Replay or duplicate upload | Duplicate records/objects | Client upload IDs, deterministic keys, D1 uniqueness, bounded retries | Test concurrent/replayed uploads in staging |
| Migration endpoint abuse | Arbitrary D1/R2 writes | Token-gated routes, safe household keys, source SHA-256 verification, non-empty-target refusal, production hostname refusal | Remove/rotate migration secret after rehearsal; disable routes |
| D1/R2 deletion or corruption | Irrecoverable family history | Versioned R2 media manifests, database snapshots/checksums, D1 Time Travel planned, Ubuntu backup retained | Clean-room restore and off-account copy |
| Accidental household deletion | Permanent family-history loss or an inconsistent partial delete | Disabled-by-default exact-name confirmation, owner/admin authorization, persisted deletion state, backup-first execution, active-write lock, bounded resumable media deletion, audit event, and queued-job retirement | Resolve retention/approval policy; rehearse enabled deletion against staging and verify restore |
| Email provider failure or account takeover | Invitation/recovery failure or phishing risk | Generic recovery response, Resend idempotency keys, bounded auth limits, no raw tokens in logs | Verify SPF/DKIM/DMARC, bounce handling, secret rotation |
| External Places/geocoder abuse | Cost, provider block, location privacy exposure | Worker-side rate limits/cache, bounded backfill, Places/location kill switches | Set provider budget/terms and staging failure tests |
| Operational cost or traffic spike | Free-tier outage or surprise bill | Per-household quotas, runtime kill switches, bounded pages/jobs, request IDs, operations endpoint | Add usage dashboards/alerts and upgrade policy |
| Ubuntu/Cloudflare split-brain writes | Divergent data during cutover | Direct Worker owns the live route; Ubuntu is retired as an active origin and retained read-only for rollback; runbook requires a write freeze before any reversal | Enforce host-level Ubuntu write freeze; preserve accepted-write exports and rehearse rollback |

## Security invariants before beta

- No new production deployment while ownership, staging, migration, or rollback
  gates remain unresolved.
- No application request reads Ubuntu after cutover approval.
- No private R2 object is read before household/share authorization.
- No secret, password, session token, reset token, share token, raw photo bytes,
  or unnecessary GPS coordinates enters logs or repository files.
- Migration-only credentials are short-lived, staging-scoped, and removed after
  rehearsal.
- Disabled features fail closed with a retryable response and do not reveal
  configuration values.
