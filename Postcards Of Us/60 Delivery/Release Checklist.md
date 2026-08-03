---
tags:
  - delivery/release
status: active
---

# Release Checklist

## Product

- [ ] Release scope and known limitations are clear.
- [ ] Beta invitation and support expectations are current.
- [ ] No deferred feature was enabled accidentally.

## Quality

- [ ] Frontend build passes.
- [ ] Backend smoke test passes.
- [ ] Core memory, photo, journey, map, and share flows pass.
- [ ] Mobile touch and camera/library upload behavior is checked.

## Privacy and security

- [ ] No secrets or private production data are in logs or artifacts.
- [ ] Ownership checks cover changed endpoints.
- [ ] Shared links expose only intended journeys.
- [ ] Photo access remains private.

## Operations

- [ ] Database backup is fresh.
- [ ] Photo backup is fresh.
- [ ] Rollback or recovery path is known.
- [ ] Cloudflare Worker, D1, R2, email, and error telemetry are reviewed.
- [ ] Authenticated smoke test passes on desktop and both primary phones.
- [ ] [[60 Delivery/Build Log|Build Log]] and [[60 Delivery/Journals/Production Journal|Production Journal]] are updated.
