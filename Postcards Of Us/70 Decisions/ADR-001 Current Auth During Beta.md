---
tags:
  - decision/adr
status: accepted
date: 2026-08-02
---

# ADR-001: Keep current authentication during beta

## Context

The beta is small and invitation-only. The app already uses username/password
authentication with bcryptjs and JWT sessions.

## Decision

Keep the current authentication flow unchanged during beta.

## Consequences

This reduces beta risk and keeps attention on the core product loop. Social
login, account linking, and broader signup remain post-beta work.

## Review trigger

Revisit before paid founding beta or public signup.
