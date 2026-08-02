---
tags:
  - delivery/operations
status: active
---

# Production Operations

## Current deployment

- Ubuntu host
- Docker and Docker Compose
- PostgreSQL
- Cloudflare Tunnel
- Local photo storage
- Encrypted Cloudflare R2 backups

See the repository's [production deployment runbook](../../PRODUCTION_DEPLOYMENT.md)
for commands and environment details.

## Operational checklist

- [ ] Run the post-deploy smoke test after releases.
- [ ] Confirm the latest database backup.
- [ ] Confirm photo backup freshness.
- [ ] Check disk usage and photo storage growth.
- [ ] Verify PWA behavior on both primary phones.
- [ ] Complete a restore drill before public signup.

## Release rule

For the beta, prioritize safe, reversible deployments and personal support.
Before paid or public access, add monitoring and recovery evidence for account,
database, photo, and tenant-isolation paths.
