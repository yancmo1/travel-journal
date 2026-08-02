---
tags:
  - delivery/process
status: active
---

# Change Management

| Record | Question answered | Update when |
|---|---|---|
| `TODO.md` | What small implementation work remains? | Task status changes |
| [[60 Delivery/Build Log|Build Log]] | Which build or deployment ran? | Important build, smoke test, or deploy |
| [[60 Delivery/Journals/Development Journal|Development Journal]] | What happened while building or investigating? | Material work session or verification |
| [[60 Delivery/Journals/Production Journal|Production Journal]] | What happened in a production environment? | Deploy, backup, restore, incident, or migration |
| [[70 Decisions/Decision Log|Decision Log and ADRs]] | Why is a durable choice part of the product or architecture? | Accepted, superseded, or rejected decision |

## Agent closeout

Before handing off material work, ask:

- Did it change user-visible behavior? Update the repository changelog if appropriate.
- Did it create useful engineering history? Add a development journal entry.
- Did it touch production or external services? Add a production journal entry.
- Did it create a durable choice? Add or update an ADR.
