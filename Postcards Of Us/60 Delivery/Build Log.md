---
tags:
  - delivery/build
status: active
---

# Build Log

Record important local, CI, deployment, and smoke-test results here. Keep
credentials, private endpoints, and unredacted production data out of entries.

| Date | Build or deploy | Environment | Result | Evidence |
|---|---|---|---|---|
|  |  |  |  |  |
| 2026-08-03 | Direct Worker beta cutover | Cloudflare production | Passed public smoke baseline; root domain now routes to `travel-journal`; Ubuntu retired as active origin | [[CLOUDFLARE_LIVE_SMOKE]]; [[CLOUDFLARE_DEPLOYMENT_INVENTORY]] |
| 2026-08-03 | Snapshot restore verification | Cloudflare staging | Passed; application table counts matched and referenced private media was present in separate D1/R2 resources | [[CLOUDFLARE_LIVE_SMOKE]]; [[CLOUDFLARE_DEPLOYMENT_INVENTORY]] |
# Product language alignment — Memory-first

- Renamed user-facing “Trips” navigation and actions to “Memories”.
- Updated dashboard, analytics, landing, photo analysis, journey copy, README,
  and active Obsidian product/engineering notes to use the memory-first model.
- Kept legacy `trips`, `trip_id`, and `/api/trips` names in the compatibility
  layer; a database/API rename requires a separate migration plan.
