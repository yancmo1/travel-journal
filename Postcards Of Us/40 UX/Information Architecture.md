---
tags:
  - ux/ia
status: active
---

# Information Architecture

```mermaid
flowchart TD
    Launch["Landing page"] --> SignIn["Sign in"]
    SignIn --> Home["Daily memory / home"]
    Home --> Memory["Memory"]
    Home --> Journey["Journey"]
    Home --> Map["Map and places"]
    Home --> People["People"]
    Memory --> Photos["Photos and notes"]
    Journey --> Share["Private share"]
    Home --> Cleanup["Cleanup"]
    Home --> Timeline["Timeline / On This Day"]
```

## Primary hierarchy

Journey → memory/place → photos, people, dates, and notes.

The app should help users move between the emotional story view and the
structured record without making either one feel secondary.
