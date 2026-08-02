# Auth and Accounts

## Current implementation

- Frontend auth state is managed in `src/context/AuthContext.jsx`.
- API calls are centralized in `src/utils/api.js`.
- Backend routes are under `backend/src/routes/auth.js`.
- Passwords use `bcryptjs`.
- Sessions are represented by JWTs signed with `JWT_SECRET`.
- The default JWT lifetime is seven days unless `JWT_EXPIRES_IN` overrides it.
- Public registration is disabled unless `ALLOW_PUBLIC_REGISTRATION=true`.

## Beta policy

Keep this flow unchanged for the invite-only beta. Verify the existing account
and invitation flows before expanding access.

## Reconciliation item

The frontend expects invitation, password-reset, and email-verification API
operations, while the currently inspected backend auth route is much smaller.
Treat this as a verification task before public signup; do not assume an
endpoint is production-ready because the client has a method for it.

## Post-beta account model

Use a stable internal user record with one or more linked identities:

| Identity | Stable key |
|---|---|
| Password | Internal user ID and password hash |
| Google | Provider subject ID |
| Facebook | Provider subject ID |
| Apple | Provider subject ID |

The provider subject ID, not a mutable display name, should identify an OAuth
identity. Account linking should require an authenticated user or a verified
invitation and should prevent accidental duplicate accounts.
