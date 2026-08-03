---
tags:
  - delivery/backlog
status: active
---

# Backlog

## Now — beta readiness

- [ ] Verify tenant isolation across trips, journeys, travelers, photos, analytics, exports, and shared links.
- [ ] Verify that photo URLs cannot bypass ownership checks.
- [x] Restore the production snapshot into isolated staging and verify table
      counts and referenced private media.
- [ ] Complete a repeatable clean-room restore from a scheduled backup and
      decide retention plus off-account-copy policy.
- [ ] Confirm the invitation-only signup path works end to end.
- [ ] Test the main workflows on both primary phones.

## Next — account and reliability

- [ ] Reconcile the frontend's expected auth endpoints with the backend auth routes.
- [ ] Verify password reset and email verification in the deployed environment.
- [ ] Add session/token revocation.
- [ ] Add safe account deletion and customer data export.
- [ ] Confirm login and registration rate limiting is active.
- [ ] Add monitoring for failed logins, failed uploads, storage, backups, and errors.

## Later — post-beta account access

- [ ] Add optional social login for Google, Facebook, Apple, and other selected providers.
- [ ] Add account linking and recovery rules for password and OAuth identities.
- [ ] Add controlled public signup after privacy gates pass.

## Completed product work

- [x] Add printable or downloadable family travel books.
- [x] Add private share links for selected journeys.

The repository's [TODO](../../TODO.md) remains the detailed implementation
checklist for smaller tasks.
