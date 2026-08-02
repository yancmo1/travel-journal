---
tags:
  - product/account-access
status: planned
date: 2026-08-02
---

# Social Login

Social login is a post-beta feature for both account creation and sign-in.

## Candidate providers

- Google
- Facebook
- Apple
- Additional providers only when beta users or the target market justify them

## Product requirements

- OAuth must not bypass the invitation-only gate.
- A provider identity must create or link one internal user account.
- Existing password users must be able to link a provider without losing data.
- The UI must clearly explain which email/account is being used.
- A user must retain a recovery method before unlinking a provider.

See [[50 Engineering/Auth and Accounts|Auth and Accounts]] for the identity
model and [[70 Decisions/ADR-002 Social Login After Beta|ADR-002]] for the
timing decision.
