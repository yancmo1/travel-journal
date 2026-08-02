---
tags:
  - engineering/data
status: verification
---

# Data and Tenant Model

## Ownership boundary

Every customer-owned read, write, delete, upload, export, and share operation
must be checked server-side against the active household or user ownership
boundary.

## Records to verify

- Users and household memberships
- Trips and journeys
- Travelers
- Photos and private file paths
- Analytics
- Exports and backups
- Shared journey links

## Acceptance checks

- [ ] User A cannot read User B's records by changing an ID.
- [ ] User A cannot update or delete User B's records.
- [ ] User A cannot attach a photo to User B's trip.
- [ ] Shared links expose only the intended journey.
- [ ] Direct photo URLs cannot bypass ownership.

See the [Public Sales PRD](../../PUBLIC_SALES_PRD.md) for the full P0 tenant
isolation and photo privacy acceptance criteria.
