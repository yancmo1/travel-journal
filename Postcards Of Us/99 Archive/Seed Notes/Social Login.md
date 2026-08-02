# Social Login

**Status:** Planned after beta  
**Related:** [[Decision Log]], [[Auth and Accounts]], [[Backlog]]

## Goal

Reduce signup and sign-in friction by allowing users to authenticate with a
trusted identity provider while preserving Postcards of Us' private,
invitation-based account model.

## Candidate providers

- Google
- Facebook
- Apple
- Additional providers only if beta users request them or the target market requires them

## Required behavior

- OAuth sign-in must not bypass the invitation-only gate.
- A verified provider identity should create or link one internal user account.
- Existing password users must be able to link a provider without losing data.
- A user must be able to unlink a provider only when another recovery method remains.
- The app should continue issuing its normal authenticated session after OAuth completes.
- Provider access and refresh tokens should not be stored unless a future feature genuinely needs them.
- The UI should clearly explain which email/account is being used.

## Open decisions

- Choose a managed identity service or implement OAuth at the backend.
- Decide whether invitation matching uses verified email, an invitation token, or both.
- Decide which providers are worth supporting after beta interviews.
- Define account recovery and duplicate-account handling before launch.
