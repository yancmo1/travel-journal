# Backlog

## P0 — Beta and public-safety blockers

- [ ] Verify tenant isolation across trips, journeys, travelers, photos, analytics, exports, and shared links.
- [ ] Verify that photo URLs cannot bypass ownership checks.
- [ ] Complete and document a clean-environment backup restore drill.
- [ ] Confirm the invitation-only signup path works end to end.

## P1 — Account and reliability work

- [ ] Reconcile the frontend's expected auth endpoints with the backend auth routes.
- [ ] Verify password reset and email verification in the deployed environment.
- [ ] Add session/token revocation.
- [ ] Add safe account deletion and customer data export.
- [ ] Confirm login and registration rate limiting is active.
- [ ] Add monitoring for failed logins, failed uploads, storage, backups, and errors.

## Later — Product improvements

- [x] Add printable or downloadable family travel books.
- [x] Add private share links for selected journeys.
- [ ] Add optional social login for account creation and sign-in: Google, Facebook, Apple, and other providers selected for the target audience.
- [ ] Add account linking and recovery rules for users who start with a password and later use OAuth.

## Existing detailed checklist

The repository's [TODO](../TODO.md) remains the implementation checklist for
small product tasks. The [Public Sales PRD](../PUBLIC_SALES_PRD.md) contains the
full beta gates, privacy requirements, and launch risks.
