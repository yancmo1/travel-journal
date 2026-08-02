# Decision Log

## D-001 — Keep current authentication during beta

**Date:** 2026-08-02  
**Status:** Accepted

The beta will continue using the existing username/password and JWT flow. The
beta is small and invitation-only, so changing authentication now would add
risk without improving the learning goal.

## D-002 — Add social login after beta

**Date:** 2026-08-02  
**Status:** Accepted

Social login is a planned post-beta feature for both account creation and
sign-in. The initial provider list is Google, Facebook, and Apple, with the
final set chosen based on the target audience and implementation cost. OAuth
must remain behind the invitation, household, and account-linking rules.

## D-003 — Use an Obsidian vault as the planning layer

**Date:** 2026-08-02  
**Status:** Accepted

The `obsidian/` folder is the project's planning and knowledge-management
layer. Existing repository documents remain the detailed technical and
operational sources of truth; vault notes summarize them, connect them, and
track decisions and work.

## D-004 — Keep the product private by default

**Date:** 2026-08-02  
**Status:** Accepted

Postcards of Us is a private family storybook, not a public social network.
Public signup and broader sharing require explicit privacy and tenant-isolation
verification first.
