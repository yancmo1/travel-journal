# Public Sales Product Requirements Document

## Postcards of Us

**Planning baseline:** July 2026  
**Document purpose:** Define the smallest safe, understandable path from the
current family app to an invite-only public beta and eventually a paid product.

## 1. Executive summary

Postcards of Us is a private family travel storybook. It turns travel places,
photos, dates, people, and notes into an organized history that families can
revisit, share privately, and preserve as a keepsake.

The current application already contains enough functionality to create a
convincing demo. The work required for public sales is primarily:

1. make the product understandable to someone who did not build it;
2. make it safe for multiple unrelated families;
3. make onboarding and importing easy enough for ordinary users;
4. run a small, free, invite-only beta;
5. use beta feedback to decide what people will pay for;
6. add paid hosting and billing only when the evidence justifies it.

The initial operating principle is **zero new infrastructure cost while
learning**, with strict limits and no promise of production-grade uptime during
the free beta.

## 2. Product definition

### 2.1 One-sentence description

> A private family storybook for turning years of travel memories into journeys,
> maps, photo galleries, and keepsakes.

### 2.2 Customer-facing description

> Postcards of Us helps your family preserve the places you have visited and
> the stories attached to them. Add a trip, bring in photos, group stops into a
> journey, see your history on a map, and share a private story with the people
> who were there.

### 2.3 What the product is not

It is not initially:

- a travel booking service;
- a recommendation engine;
- a public social network;
- a real-time travel safety tool;
- a replacement for a general photo backup service;
- a genealogy database for every branch of a family;
- an unlimited cloud drive.

Keeping this narrow is important. The product is about preserving completed
travel memories.

## 3. Product thesis

Families have valuable travel memories, but the memories are fragmented across
photos, devices, paper, and conversations. The person who cares most about
preserving them often lacks a simple tool and does not want a complicated
technical project.

If we make it easy to collect a few memories and immediately see a meaningful
result—a map, a journey, a story, or a shareable keepsake—families may continue
adding more history and eventually pay for a private, lasting archive.

## 4. Goals and non-goals

### 4.1 Goals for the public-sales effort

- Produce a clear demo that can be understood in under two minutes.
- Recruit a small group of real beta families at zero new infrastructure cost.
- Protect each family’s data from every other family.
- Make it easy to add the first journey.
- Learn what customers value enough to pay for.
- Establish a credible story around privacy, ownership, and export.
- Create a path from free beta to paid hosting without rebuilding the product.

### 4.2 Non-goals for the first release

- Native iOS and Android apps.
- Automatic import from every photo service.
- AI-generated biographies or travel writing.
- Public discovery of family journeys.
- Complex collaboration permissions.
- Unlimited storage.
- Multiple geographic regions or enterprise deployment.
- A large paid advertising campaign.

## 5. Primary users

### 5.1 Primary customer: the family archivist

This is usually one person in a family who already collects photos, remembers
dates, saves old documents, or organizes reunions. They may not consider
themselves technical.

Their needs:

- simple setup;
- reassurance that photos will not disappear;
- a pleasant way to tell the story;
- a way to involve other family members;
- help cleaning up years of disorganized material;
- exports and backups so the family is not trapped.

### 5.2 Secondary users

- spouses and partners;
- children and grandchildren;
- adult children helping a parent;
- friends who shared a journey;
- family members who only receive shared links.

### 5.3 Early beta profile

The first beta testers should be people who:

- know Yancy or Amber personally;
- have at least five meaningful trips to record;
- have photos or notes available;
- are willing to give feedback;
- understand that the beta is limited and may require personal help.

Do not recruit only technically confident people. At least half of the testers
should be ordinary users who will expose confusing language and workflows.

## 6. Core value proposition

### Functional value

- One place for trips, places, people, dates, notes, and photos.
- A map and timeline that make the history visible.
- Journeys that turn separate stops into a complete story.
- Private sharing instead of public posting.
- A printable or downloadable keepsake.

### Emotional value

- “Our family history is not scattered anymore.”
- “I can show the grandchildren where we have been.”
- “The stories are attached to the photos.”
- “This feels like something worth keeping.”

### Trust value

- Private by default.
- No need to make family memories public.
- Exportable data.
- Backups and a clear recovery plan.
- Honest storage limits and pricing.

## 7. Current product foundation

The current app already includes the following demonstrable capabilities:

| Capability | Current state | Demo value |
|---|---|---|
| Daily memory | Present | Creates an emotional reason to return |
| Trips and places | Present | Basic record of each memory |
| Journeys | Present | Turns stops into a coherent story |
| Interactive map | Present | Makes a family history visual |
| Flexible dates | Present | Supports imperfect memories |
| Traveler tracking | Present | Shows who shared the experience |
| Photo uploads | Present | Gives memories visual context |
| Photo resizing/thumbnails | Present | Reduces storage use |
| Cleanup tools | Present | Helps repair old data |
| Analytics | Present | Gives a sense of the family’s history |
| Offline behavior | Present | Useful for imperfect connectivity |
| Private journey links | Present | Enables family sharing |
| Print/save as PDF | Present | Produces a tangible keepsake |
| Backups | Present for current deployment | Supports trust and operations |

The demo should showcase the emotional flow, not every administrative feature.

## 8. Release strategy

### Phase 0: internal demo

**Purpose:** Make the story easy to show.

**Audience:** Yancy, Amber, close family.

**Requirements:**

- polished sample data that is safe to show;
- one attractive journey with several stops;
- photos, captions, and a short summary;
- a working map;
- a private share link;
- a printable journey;
- a short demo script.

**Exit criteria:** Amber can demonstrate the product to someone else without
technical assistance.

### Phase 1: zero-cost invite-only beta

**Purpose:** Test usefulness with real families.

**Audience:** Approximately 3–10 invited households.

**Operating model:**

- manual invitations;
- free trial for a defined period, such as 30–60 days;
- personal onboarding help;
- no public signup link;
- no uptime guarantee;
- strict photo and storage limits;
- weekly or biweekly feedback;
- immediate ability to delete or export a tester’s data.

**Exit criteria:** At least five households create real content and return to it.

### Phase 2: paid founding beta

**Purpose:** Test willingness to pay before investing in a full SaaS system.

**Audience:** Beta users who completed onboarding and saw value.

**Possible offer:**

- founding household plan;
- simple annual price;
- limited founding-user storage;
- direct support from Yancy and Amber;
- clear statement that the product is still evolving.

The exact price should be tested after beta interviews rather than selected by
gut feel alone.

**Exit criteria:** Several unrelated households pay and continue using it.

### Phase 3: public paid launch

**Purpose:** Allow people outside the personal network to sign up safely.

**Requirements:**

- production tenant isolation;
- password recovery;
- reliable backups and restore testing;
- storage quotas;
- terms and privacy policy;
- billing and subscription management;
- support contact and incident process;
- hosted demo or guided trial;
- clear cancellation and export process.

## 9. Zero-cost beta hosting plan

This plan assumes continued use of the existing Ubuntu server and current
Cloudflare-based deployment.

### 9.1 Where each thing lives

| Data or service | Beta location | Notes |
|---|---|---|
| Frontend | Existing Ubuntu server | Served through the existing app stack |
| API/backend | Existing Ubuntu server | Dockerized Node service |
| PostgreSQL | Existing Ubuntu server | Must be backed up and access restricted |
| Uploaded photos | Existing Ubuntu disk | Main beta storage |
| Encrypted backup | Existing R2 backup destination | Backup, not necessarily live serving |
| Public access | Cloudflare Tunnel | Secure connection to the home server |
| Container images | Existing GitHub Container Registry workflow | Deployment artifact, not customer data |
| Domain | Existing domain | Use a separate public-facing hostname if useful |

### 9.2 Beta limits

The beta must have limits that protect the home server:

- no more than 10 households initially;
- no more than 2–5 GB per household unless manually approved;
- reasonable photo upload size limit;
- maximum number of uploads per day;
- no video uploads in the first beta;
- no public indexing of private journeys;
- no promise of continuous availability;
- manual suspension if a household exceeds its limit.

The limits should be presented honestly as “founding beta limits,” not hidden.

### 9.3 Zero-cost does not mean zero risk

The home-server beta has these risks:

- power failure;
- internet outage or low upload speed;
- server hardware failure;
- accidental deletion;
- backup failure;
- residential ISP restrictions;
- one user consuming too much storage or bandwidth;
- personal responsibility for customer privacy.

Before inviting anyone, verify the home internet provider’s acceptable-use
rules and confirm that backups can actually be restored.

### 9.4 When to spend money

Spending should be triggered by evidence, not anxiety. Move to paid
infrastructure when one or more of these occur:

- beta storage approaches the safe disk limit;
- home internet upload becomes slow for normal use;
- the server cannot provide acceptable availability;
- more than 10–20 households are active;
- customers are paying enough to justify reliability;
- backups need independent storage;
- the application needs a managed database or monitoring.

The likely next step is a small cloud VPS for the app and database, with object
storage for photos and backups. Cloudflare R2 currently lists 10 GB-month of
Standard storage, 1 million Class A operations, 10 million Class B operations,
and no egress charge in its free tier; verify current pricing before relying on
it for production. See the [Cloudflare R2 pricing page](https://developers.cloudflare.com/r2/pricing/).

DigitalOcean is one example of a small VPS provider; its current pricing page
lists basic Droplets beginning at $4/month, with a 2 GB option listed at
$12/month. This is an example for planning, not a required vendor choice. See
the [DigitalOcean pricing page](https://www.digitalocean.com/pricing/droplets).

## 10. Critical technical work before public signup

### P0: tenant isolation

This is the highest-priority release blocker.

Every customer-owned record must be reachable only by the correct household.
The backend must enforce ownership for:

- trips;
- journeys;
- travelers;
- photos;
- shared links;
- analytics;
- backups and exports.

Every read, update, delete, upload, and share operation must verify ownership
on the server. Hiding records in the frontend is not sufficient.

Acceptance criteria:

- create two test users;
- create separate data for each user;
- verify that User A cannot read User B’s records by changing an ID in a request;
- verify that User A cannot update or delete User B’s records;
- verify that User A cannot attach a photo to User B’s trip;
- verify that shared links expose only the intended journey;
- automate these checks as integration tests.

### P0: photo privacy

Photo URLs must not expose unrelated customers’ files through guessable paths.
Use ownership checks, private storage, signed URLs, or an authenticated image
proxy as appropriate.

Acceptance criteria:

- a direct photo URL cannot be used to bypass ownership;
- revoked journeys no longer expose their photos through the share path;
- deleting a memory deletes or safely retires its photo files;
- backup files are not publicly reachable.

### P0: backup and restore

The system must have:

- nightly database backup;
- photo backup or replicated photo storage;
- an off-server copy;
- backup freshness monitoring;
- a documented restore procedure;
- a successful restore drill before public signup.

Acceptance criteria:

- restore a test account into a clean environment;
- verify trips, journeys, users, and photos;
- record how long restoration takes;
- document what data could be lost between backups.

### P1: account lifecycle

Add:

- password reset;
- email verification or another account-recovery method;
- session/token revocation;
- rate limiting on login and registration;
- safe account deletion;
- customer data export.

### P1: upload safety

Add or verify:

- file type validation;
- file size limits;
- image processing limits;
- protection from malicious filenames and paths;
- upload throttling;
- clear progress and failure messages;
- cleanup of incomplete uploads.

### P1: monitoring

Track:

- server health;
- disk usage;
- database size;
- photo storage size;
- backup freshness;
- failed uploads;
- failed logins;
- error rate;
- certificate and domain health.

The beta can use simple existing tools and manual checks. Public sales require
alerts that do not depend on someone noticing a problem by accident.

## 11. Demo requirements

The demo must answer “What does this do?” in less than two minutes.

### Demo story

Use one fictional or consented family journey with:

- a clear title;
- several stops;
- different dates;
- multiple travelers;
- short human notes;
- a few attractive photos;
- a map route;
- a cover image;
- a shareable journey;
- a print/PDF output.

### Demo sequence

1. Open on a daily memory.
2. Show the family’s totals and map.
3. Open one journey.
4. Walk through the stops and photos.
5. Show the private link.
6. Show the printable travel book.
7. Explain that imperfect dates are acceptable.

### Demo quality bar

- no personal passwords visible;
- no broken images;
- no empty screens in the primary path;
- no confusing technical terms;
- no real private family information unless consented;
- works on a phone-sized screen;
- presenter can recover from a failed network request.

## 12. Beta onboarding

The beta should be concierge-style at first. Personal help is a feature because
it teaches us what future self-service onboarding must do.

### First-session flow

1. Welcome the household.
2. Explain that the first goal is one complete journey.
3. Help them add three to five memories.
4. Add one or two travelers.
5. Upload a small number of photos.
6. Open the map.
7. Generate a private share link.
8. Explain backup and export.

Do not ask users to organize their entire life before they see a result.

### Beta welcome message

> Start with one trip that matters to you. Add the places, the people who went,
> a few photos, and the story you still remember. You can fill in the rest over
> time.

### Beta support

- one direct support email or message channel;
- response target of one business day when practical;
- short feedback conversations after the first session;
- a visible way to report a problem;
- a promise to explain what happens to their data.

## 13. Marketing and sales plan

### 13.1 Positioning

Primary message:

> Turn your family’s scattered travel memories into one private storybook.

Supporting messages:

- See your life on a map.
- Put every stop back into the journey it belonged to.
- Keep the stories with the photos.
- Share privately with the people who were there.
- Preserve the result as a keepsake.

### 13.2 First marketing assets

- public landing page;
- 45–90 second screen-recorded demo;
- fictional sample account;
- three screenshots showing dashboard, map, and journey;
- short founder story about why the product was made;
- beta signup form;
- simple FAQ about privacy, hosting, backups, and limits;
- one-page explanation suitable for sending to friends.

### 13.3 First distribution channels

Start with direct, trusted channels:

- friends and family referrals;
- family-history groups;
- travel and retirement communities;
- local genealogy clubs;
- reunion and anniversary planning groups;
- personal social posts showing a real journey;
- short educational posts about organizing old travel photos.

Do not buy ads until the product has proven that people complete onboarding and
return.

### 13.4 Landing-page structure

1. Emotional headline.
2. One-sentence explanation.
3. Screenshot or short demo.
4. Three simple benefits.
5. Example journey.
6. Privacy and ownership explanation.
7. Beta offer and limits.
8. Signup button.
9. FAQ.

### 13.5 Example landing-page copy

**Headline:** Your family history, brought to life through the places, people,
and moments you’ve shared.

**Subheadline:** Postcards of Us turns travel photos, places, dates, and stories
into a private family storybook you can revisit, share, and keep.

**Button:** Join the founding beta

**Three benefits:**

- Remember every stop, not just the destination.
- See your family history on a map and timeline.
- Share a private journey or save it as a keepsake.

## 14. Business model hypotheses

These are hypotheses to test, not final decisions.

### Option A: household subscription

One subscription covers a household, with storage limits and private sharing.
This is the most natural long-term model if families keep adding memories.

### Option B: annual archive plan

A simple annual plan may be easier for this audience than a complicated monthly
software menu.

### Option C: setup and migration service

Charge for personal help importing and organizing years of photos. This may be
valuable for older users or families preparing a reunion or memorial.

### Option D: software plus keepsake

Offer printed books or professionally prepared digital archives later. Do not
build this first; learn whether people want it through the beta.

### Pricing rules

- never promise unlimited photo storage at a low price;
- make storage limits clear before upload;
- include export in every plan;
- offer annual pricing once people understand the value;
- keep the first paid plan simple;
- price support and migration work separately if they consume real time.

## 15. Metrics

### Beta health metrics

- invited households;
- households that complete first journey;
- time to first meaningful result;
- memories added per household;
- photos uploaded;
- journeys completed;
- private links created;
- repeat visits after 7 and 30 days;
- support requests;
- users who ask for export or printing;
- users who say they would pay.

### Most important early metric

**Completed family journeys per active household.**

This is more meaningful than registrations. A registration without a completed
story is not evidence of product value.

### Suggested beta success threshold

Move toward paid infrastructure only after:

- at least five households complete a journey;
- at least three return without being reminded;
- at least two share a journey with someone else;
- at least two express interest in paying;
- no unresolved critical privacy or backup issue remains.

## 16. Roles for Yancy and Amber

### Yancy

- technical ownership;
- hosting and deployment;
- security and backups;
- data model and APIs;
- product instrumentation;
- fixing beta issues;
- infrastructure migration when needed.

### Amber

- customer perspective;
- plain-language review;
- visual and emotional direction;
- beta-family recruiting;
- onboarding observation;
- feedback interviews;
- prioritizing what feels valuable;
- reviewing marketing language and demos.

### Shared decisions

Yancy and Amber should jointly decide:

- the final name and public tone;
- which audience to target first;
- the beta rules;
- what privacy promise can honestly be made;
- what feature is worth paying for;
- when the project is ready to accept money.

## 17. Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Users do not understand the product | Marketing fails before usage begins | Use a two-minute demo and plain language |
| Users like the idea but do not add data | No evidence of real value | Concierge onboarding and first-journey goal |
| One user consumes too much storage | Home server becomes the bottleneck | Storage quotas and no video in beta |
| Customer data crosses accounts | Severe privacy failure | Server-side tenant isolation tests before public signup |
| Server goes offline | Users lose trust | Honest beta disclaimer, backups, later VPS migration |
| Photos are lost | Core promise is broken | Off-server backups and restore drills |
| Support takes too much time | Low-priced plans become unprofitable | Measure support and price setup help separately |
| Feature scope grows endlessly | Launch is delayed | Keep the first product about completed travel memories |
| Free hosting ends unexpectedly | Service interruption | Track limits and maintain a migration plan |

## 18. Release gates

### Gate A: demo-ready

- Amber can understand and explain the product.
- Sample journey looks good.
- Main demo path works on desktop and phone.
- No private data is exposed.

### Gate B: beta-ready

- Separate beta accounts work.
- Data ownership is tested for all major entities.
- Photos cannot bypass access control.
- Backups run and a restore drill succeeds.
- Storage and upload limits are active.
- Beta support process exists.

### Gate C: paid-beta-ready

- Real beta users complete journeys.
- Export works.
- Privacy and data-retention explanation is written.
- Pricing hypothesis is selected.
- Founder support capacity is understood.

### Gate D: public-sales-ready

- Tenant isolation is automated in tests.
- Password recovery works.
- Billing and cancellation work.
- Monitoring and alerts exist.
- Legal pages are published.
- Restore process is documented.
- Hosting cost per household is understood.
- There is a clear incident and support process.

## 19. Immediate implementation backlog

### First priority

- Create a polished sample/demo dataset.
- Create a two-minute demo flow.
- Build a simple landing page or public demo page.
- Audit every backend route for `created_by` ownership checks.
- Add automated cross-account access tests.
- Verify photo access control.
- Confirm the current backup restore drill.

### Second priority

- Add beta invitation flow or manual invite process.
- Add account deletion and export.
- Add visible storage limits.
- Improve first-run onboarding.
- Add basic error monitoring.
- Document beta support and feedback collection.

### Later

- Automated photo imports.
- Household invitations and roles.
- Billing.
- Managed cloud hosting.
- Object storage for live photos.
- Printed-book ordering.
- Public launch campaign.

## 20. Final decision framework

At the end of the beta, ask:

1. Did people finish a real journey?
2. Did they return to look at it?
3. Did they share it?
4. Did they trust us with more memories?
5. Did they ask for a feature that points to a clear paid benefit?
6. Would the revenue justify hosting and support?
7. Do Yancy and Amber still want to work on it together?

If the answer is mostly yes, invest in public sales. If the answer is mixed,
keep the product as a private family tool while using the feedback to narrow the
idea. That is still a successful outcome.
