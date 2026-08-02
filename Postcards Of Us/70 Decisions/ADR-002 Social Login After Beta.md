---
tags:
  - decision/adr
status: accepted
date: 2026-08-02
---

# ADR-002: Add social login after beta

## Context

Social login may reduce account-creation friction, but adding providers now
would expand authentication and account-linking risk during a small beta.

## Decision

Plan optional Google, Facebook, Apple, and other selected social logins after
the beta. Provider choice will be validated against beta demand and audience.

## Constraints

- OAuth cannot bypass invitations or household membership.
- Provider identities must link to one internal account.
- Existing password users must not lose their data.
- Recovery must remain possible if a provider is unavailable.

## Review trigger

Revisit when beta evidence shows sign-in friction or public onboarding becomes
a priority.
