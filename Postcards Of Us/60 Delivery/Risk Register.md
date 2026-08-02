---
tags:
  - delivery/risks
status: active
---

# Risk Register

| ID | Risk | Likelihood | Impact | Owner | Mitigation | Trigger |
|---|---|---:|---:|---|---|---|
| R1 | Household data crosses ownership boundaries | High | Severe | Engineering | Server-side isolation tests for every owned record | Any cross-household read or write |
| R2 | Photo URLs expose private media | Medium | Severe | Engineering | Private storage, ownership checks, signed/proxied access | Direct URL bypass |
| R3 | Backups cannot be restored | Medium | High | Operations | Clean-environment restore drill and freshness monitoring | Restore failure or stale backup |
| R4 | Beta onboarding requires too much help | Medium | Medium | Product | Track support requests and simplify the first journey | Repeated manual intervention |
| R5 | Users expect a public social network | Medium | High | Product | Clear private-by-default copy and sharing boundaries | Requests for public discovery |
| R6 | Social login creates duplicate accounts | Medium | High | Engineering | Stable provider subject IDs and explicit linking | Same person receives two users |
| R7 | Home-server capacity limits growth | Medium | High | Operations | Storage quotas, no video in beta, backup monitoring | Disk or upload threshold |
| R8 | Feature scope delays learning | Medium | High | Product | Milestone gates and evidence review | Work starts without a user question |

## Review

Review weekly. Create an ADR if mitigation changes product scope or
architecture.
