# Postcards of Us Cloudflare Beta Incident Runbook

This runbook is for the named beta operator and rollback operator. Assign both
before inviting anyone outside the owner’s household.

## First response for every incident

1. Record UTC time, request IDs, affected route, and the first known symptom.
2. Do not delete data, rotate credentials, or alter DNS before preserving the
   relevant logs and backup identifiers.
3. Use the smallest reversible kill switch that limits harm.
4. Confirm whether Ubuntu is still read-only or whether a write freeze is
   required.
5. Escalate any suspected cross-household exposure as a security incident.

## Response matrix

| Incident | Immediate containment | Evidence to preserve | Recovery path |
| --- | --- | --- | --- |
| Auth abuse/account takeover | Disable `ENABLE_INVITATIONS`; revoke affected sessions; consider `ENABLE_UPLOADS` off | Request IDs, audit events, auth-limit rows, email provider events | Reset password, rotate secrets if exposed, verify household membership |
| Suspected data/media exposure | Disable `ENABLE_SHARING` and uploads; do not delete R2 objects | Request IDs, affected household/object keys, Worker logs, share audit events | Revoke links, inspect bucket access, notify owner, restore only if needed |
| Failed migration or checksum mismatch | Stop importer; leave Ubuntu unchanged; do not retry against production | Export manifest hash, prepared summary, target counts/bytes, failed source path | Repair staging target or create a fresh target; rerun idempotently |
| Email outage or compromised sender | Disable `ENABLE_INVITATIONS`; leave recovery generic | Resend request IDs/status, sender DNS evidence, audit events | Restore verified sender, rotate API key, resend only with owner approval |
| R2 deletion/corruption | Disable uploads/deletes if needed; preserve current manifests | Latest backup manifest, database SHA-256, media manifest SHA-256 | Restore into fresh staging resources first; never overwrite live blindly |
| D1 corruption or migration failure | Disable writes with feature flags where possible; preserve DB state | Migration version, request IDs, audit events, D1 Time Travel point | Restore into fresh D1 staging and compare counts before any live action |
| Cost/traffic spike | Disable Places, location lookups, uploads, or background jobs in that order | Operations counts, provider usage, request IDs, quota state | Identify abusive route, add limits, re-enable one feature at a time |
| Cloudflare outage | Keep Ubuntu read-only; do not create a second writable origin | Cloudflare status/time, last backup, pending writes | Follow the approved rollback plan only after owner authorization |

## Rollback rule

Rollback is a controlled DNS/runtime decision, not an automatic reverse import.
Stop Cloudflare writes, preserve accepted writes, route only after the named
operator approves, and reconcile data deliberately before reopening Ubuntu
writes.

