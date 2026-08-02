# Project Overview

## Product

Postcards of Us is a private family travel storybook. It turns places, photos,
dates, people, and notes into organized memories that can be grouped into
journeys, explored on a map, and shared privately.

## Audience

The first audience is invited families who want to preserve years of travel
memories without joining a public social network.

## Product principles

1. Privacy comes before growth.
2. A completed memory is more valuable than a large feature set.
3. The beta should teach us what families value before we add paid infrastructure.
4. Personal support is acceptable during the concierge-style beta.
5. Public signup requires verified tenant isolation, photo privacy, backups, and account recovery.

## Current state

- The app supports memories, journeys, maps, travelers, photos, cleanup, exports, private sharing, and PWA behavior.
- The deployment uses Docker, PostgreSQL, Ubuntu, Cloudflare Tunnel, local photo storage, and encrypted R2 backups.
- Registration is closed by default through `ALLOW_PUBLIC_REGISTRATION`.
- Authentication is currently custom username/password plus JWT; see [[Auth and Accounts]].
- Social login is intentionally deferred until after the beta; see [[Social Login]].

## Success for the beta

- Invited families can sign in and complete the core memory workflow.
- Separate households cannot access one another's records or photos.
- Backups and restore procedures are proven, not merely configured.
- Real usage identifies the features worth hardening or charging for.
