import test from 'node:test';
import assert from 'node:assert/strict';
import { locationBackfillWorkPlan } from '../worker/sites-static.js';

test('location backfill advances by trip id and schedules another bounded page', () => {
  const candidates = [
    { trip_id: 12 },
    { trip_id: 19 },
    { trip_id: 23 },
    { trip_id: 31 },
  ];

  const plan = locationBackfillWorkPlan(candidates, 3);

  assert.deepEqual(plan.processed, candidates.slice(0, 3));
  assert.equal(plan.hasMore, true);
  assert.equal(plan.nextAfterTripId, 23);
});

test('location backfill does not invent a cursor when there is no work', () => {
  assert.deepEqual(locationBackfillWorkPlan([], 3), {
    processed: [],
    hasMore: false,
    nextAfterTripId: null,
  });
});
