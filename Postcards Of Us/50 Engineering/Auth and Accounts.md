---
tags:
  - engineering/auth
status: active
---

# Auth and Accounts

## Current implementation

- Frontend auth state: `src/context/AuthContext.jsx`
- API calls: `src/utils/api.js`
- Backend routes: `backend/src/routes/auth.js`
- Password hashing: `bcryptjs`
- Sessions: JWT signed with `JWT_SECRET` or secure HTTP-only sessions
- Default JWT lifetime: seven days unless `JWT_EXPIRES_IN` overrides it
- Sign-in identity: verified email and password
- Public registration: disabled unless `ALLOW_PUBLIC_REGISTRATION=true`; when
  enabled, `MAX_TOTAL_ACCOUNTS` caps all public and invitation-created accounts
  (15 by default).

## Beta policy

The current beta uses controlled public registration with a 15-account ceiling.
Public and invitation-created accounts share the same cap. Keep the site and
each household's memories private behind sign-in, and verify email delivery
before treating the flow as fully operational.

## Reconciliation item

The frontend expects invitation, password-reset, and email-verification
operations, while the inspected backend auth route is smaller. Verify the
deployed endpoint surface before public signup; do not infer readiness from a
client method alone.

## Post-beta identity model

Use one internal user record with one or more linked identities:

| Identity | Stable key |
|---|---|
| Password | Internal user ID and password hash |
| Google | Provider subject ID |
| Facebook | Provider subject ID |
| Apple | Provider subject ID |

Provider subject IDs, not mutable display names, identify OAuth identities.
Account linking must prevent duplicate households and preserve recovery access.
