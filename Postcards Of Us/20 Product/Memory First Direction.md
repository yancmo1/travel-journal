# Memory-first direction

## Decision

Postcards of Us is a private family storybook organized around memories. A
memory is the primary record: a place, stop, event, or moment worth keeping.

A journey is an optional collection of related memories that turns separate
records into a larger story. Photos, notes, people, dates, and location details
belong to the memory they describe.

## Product language

Use these terms in the interface, product copy, research, and planning notes:

- **Memory:** the core record users create, edit, revisit, and attach photos to.
- **Journey:** a larger story made by grouping memories in order.
- **Photo:** an artifact attached directly to a memory.

Avoid using “trip” or “trips” as a product concept. A trip may still appear in
natural-language family stories or in a specific journey title such as “Road
Trip,” but it is not the app’s organizing model.

## UX implications

- The primary navigation label is **Memories**.
- Creation actions say **Add Memory** and **Add Photo(s)**.
- Every memory should offer an obvious path to add photos after creation.
- Journeys should group existing memories; they should not be required before
  a memory can be created.
- Empty, incomplete, approximate-date, and standalone memories are valid.
- The product’s defining promise is preserving and revisiting family memories,
  not planning travel.

## Compatibility boundary

The current database schema, API routes, migration names, and storage keys use
legacy `trip` terminology (`trips`, `trip_id`, and `/api/trips`). These are
implementation details retained for compatibility during the product-language
transition. Do not rename them casually; any future schema/API migration must
be planned as a separate technical change with data migration and rollback
coverage.

## Review question

When a new feature is proposed, ask: “Does this help someone preserve, find,
understand, or share a memory?” If it primarily supports planning a trip, it is
outside the current lane unless explicitly approved.
