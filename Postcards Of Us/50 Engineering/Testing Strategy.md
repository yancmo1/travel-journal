---
tags:
  - engineering/testing
status: active
---

# Testing Strategy

## Layers

- **Smoke:** sign in, create a memory, upload/view a photo, and clean up test data.
- **Integration:** ownership, invitations, sharing, uploads, exports, and account lifecycle.
- **Mobile workflow:** primary phone flows, camera/library upload, PWA install, offline behavior.
- **Operational:** deploy, backup freshness, restore, and storage monitoring.

## Definition of evidence

Every release note or backlog completion should identify the command, test, or
manual workflow that verified it. Screenshots and logs must be redacted.

## Next test priorities

- [ ] Two-household isolation matrix
- [ ] Direct photo access tests
- [ ] Invitation-only registration path
- [ ] Backup restore into a clean environment
- [ ] Phone workflow on both primary devices
