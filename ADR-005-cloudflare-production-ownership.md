# ADR-005: Cloudflare Production Ownership

**Status:** Direct Worker production ownership confirmed; Sites historical  
**Date:** 2026-08-03

## Context

The repository contains `.openai/hosting.json` with the historical Sites
project `appgprj_6a6e58b91e608191aef8c1102f6b8416` and logical bindings `DB` and
`MEDIA`. The live beta now runs from direct Worker `travel-journal` in
Cloudflare account `ed7a3a18b893e8de24e7e0ab063c1c72`, with D1
`d0b69e24-03e0-49cf-8205-265958dfd441`, private R2
`postcards-of-us-beta-media`, and the `postcardsofus.com` custom domain.
The former Sites custom-domain attachment was removed, but the project and
version history remain available as rollback context.

## Decision

Use the direct Cloudflare path for the beta. Wrangler/Cloudflare owns the
Worker, D1, R2, DNS, secrets, and deployment history in the intended account,
while preserving the logical bindings `DB` and `MEDIA`. The root hostname was
cut over on 2026-08-03 after live smoke verification. Ubuntu is retired as an
active origin and retained for rollback; the former Sites project is not an
active route.

## Consequences

- The deployment inventory records resource identifiers and account ownership,
  not only a public URL.
- Staging must use separate D1/R2 resources from production.
- Migration scripts must work against either selected deployment path without
  embedding account-specific secrets.
- `.openai/hosting.json` remains as historical Sites metadata and must not be
  deleted solely because the direct Worker is now primary.
