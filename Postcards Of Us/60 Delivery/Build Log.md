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
