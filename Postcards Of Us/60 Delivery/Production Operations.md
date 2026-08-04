---
tags:
  - delivery/operations
status: active
---

# Production Operations

## Current deployment

- Cloudflare Worker `travel-journal`
- Cloudflare D1 production database
- Private Cloudflare R2 media bucket
- Cloudflare custom domain `postcardsofus.com`
- Cloudflare scheduled jobs and Workers Logs
- Ubuntu source and final backups retained read-only for rollback

See the repository's [production deployment runbook](../../PRODUCTION_DEPLOYMENT.md)
for commands and environment details.

Production releases now come from `main` through
`.github/workflows/cloudflare-deploy.yml`. The workflow runs migration
consistency checks, tests, and the production build before deploying the
`travel-journal` Worker. The GitHub `production` environment must contain
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The `dev` branch is for
local integration and does not deploy production.

## Operational checklist

- [ ] Run the authenticated post-deploy smoke test after releases.
- [ ] Confirm the latest database backup.
- [ ] Confirm photo backup freshness.
- [ ] Check R2 storage, D1 usage, Worker requests/CPU, and external-provider
      usage.
- [ ] Verify PWA behavior on both primary phones.
- [x] Complete an isolated staging restore drill.
- [ ] Complete a repeatable clean-room restore before public signup.
- [ ] Review Workers Logs, alert thresholds, and kill-switch procedures during
      the beta stabilization window.

## Release rule

For the beta, prioritize safe, reversible deployments and personal support.
Before paid or public access, add monitoring and recovery evidence for account,
database, photo, and tenant-isolation paths.
