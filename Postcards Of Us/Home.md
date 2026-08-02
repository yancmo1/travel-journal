---
aliases:
  - Postcards of Us
  - Project Home
tags:
  - project/home
status: active
stage: invite-only-beta
---

# Postcards of Us

> A private family storybook for turning years of travel into memories,
> journeys, maps, and keepsakes.

## Current state

**Stage:** Invite-only beta  
**Decision:** Keep username/password plus JWT authentication during beta  
**Next milestone:** [[60 Delivery/Roadmap#Milestone 1 — Beta readiness|Beta readiness]]  
**Current question:** Which workflow improvements create repeat family value?

> [!warning] Scope boundary
> Postcards of Us is a private family storybook, not a public social network.
> Public signup and broader sharing require tenant-isolation and photo-privacy
> evidence first.

## Start here

- [[20 Product/Product Hub|Product]]
- [[30 Research/Research Hub|Research]]
- [[40 UX/UX Hub|UX and content]]
- [[50 Engineering/Engineering Hub|Engineering]]
- [[60 Delivery/Delivery Hub|Delivery]]
- [[70 Decisions/Decision Log|Decisions]]

## Agent operations

- [[60 Delivery/Backlog|Active backlog]]
- [[60 Delivery/Change Management|Change management]]
- [[60 Delivery/Journals/Development Journal|Development journal]]
- [[60 Delivery/Production Operations|Production operations]]
- [[80 Templates/ADR|ADR template]]
- [[Project Map.canvas|Project map]]

## Source of truth

- [Repository README](../README.md)
- [Public README](../PUBLIC_README.md)
- [Public Sales PRD](../PUBLIC_SALES_PRD.md)
- [Project TODO](../TODO.md)
- [Production deployment runbook](../PRODUCTION_DEPLOYMENT.md)
- [Server specification](../SERVER_SPECIFICATION.md)

## This week

- [ ] Verify tenant isolation across customer-owned records.
- [ ] Verify private photo access cannot be bypassed by direct URLs.
- [ ] Run and document a clean-environment backup restore drill.
- [ ] Test the main workflows on both primary phones.
- [ ] Reconcile the frontend and backend account-lifecycle endpoints.

## Working rules

1. New information lands in [[10 Inbox/Inbox|Inbox]].
2. Product changes begin as a [[80 Templates/Feature Brief|feature brief]].
3. Durable product or architecture choices become an [[80 Templates/ADR|ADR]].
4. Research claims link to evidence and label the evidence type.
5. Tasks belong to a milestone in [[60 Delivery/Roadmap|Roadmap]].
6. Never place credentials, private URLs, IP addresses, or personal photo data in notes.
7. Material work closes with the appropriate journal, changelog, build log, or ADR update.

## Useful views

- [[Project Map.canvas|Project map]]
- [[60 Delivery/Roadmap|Roadmap]]
- [[60 Delivery/Risk Register|Risk register]]
- [[30 Research/Beta Feedback Tracker|Beta feedback tracker]]
- [[50 Engineering/Testing Strategy|Testing strategy]]

**Last reviewed:** 2026-08-02
