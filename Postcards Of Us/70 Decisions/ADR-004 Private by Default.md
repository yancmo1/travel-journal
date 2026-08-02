---
tags:
  - decision/adr
status: accepted
date: 2026-08-02
---

# ADR-004: Keep the product private by default

## Context

The product stores family travel history and photos. Public discovery would
change the privacy model and increase the consequences of an ownership bug.

## Decision

Postcards of Us remains private and invitation-based. Public signup and broader
sharing require explicit tenant-isolation, photo-privacy, recovery, and backup
evidence.
