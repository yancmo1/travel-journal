---
tags:
  - product/monetization
status: accepted
---

# Monetization

## Public plan decision (2026-08-10)

Postcards of Us uses a free-but-finite public plan. The free plan must deliver
the complete core experience and let a new family create a meaningful story;
paid access removes limits and adds operating value rather than withholding
the family's existing memories.

### Free

- One private household with up to two members.
- Three journeys and approximately 150 photos / 250 MB.
- Full map, timeline, story, private sharing, and export experience.
- One active private share link.
- When a limit is reached, viewing, editing, sharing, export, and deletion
  remain available; only new additions are paused until the household upgrades.

### Plus

- $59/year as the primary public price.
- Optional $7.99/month price for customers who prefer monthly billing.
- More household members, 5 GB of storage, unlimited journeys, unlimited
  private sharing, scheduled backups, and priority support.

### Founding

Early public customers may receive a $49/year founding price that remains
locked while their subscription stays active. This is a paid offer, not a
separate feature tier.

### Beta exception

Invited beta households are not placed on the public free limits. They receive
the beta plan and can request reasonable increases directly while the product
is being learned. This override is explicit and temporary; it is not exposed
as a public plan.

The first RevenueCat entitlement should represent paid Plus access only. Free
access is the app default and does not need a RevenueCat product. Do not add a
lifetime plan. A premium trial may be added later, after a customer has seen
the first meaningful result; if enabled, use a clearly disclosed 14-day trial.

The beta should learn what families value before committing to pricing or paid
infrastructure. Possible future value may include hosted storage, easier
onboarding, reliable backups, keepsake exports, or household-level support.

## Questions

- [ ] Which capability is clearly worth paying for?
- [ ] Should pricing be per household, per year, or a one-time keepsake purchase?
- [ ] What storage and sharing limits are understandable and safe?
- [ ] What service level can be promised honestly?
