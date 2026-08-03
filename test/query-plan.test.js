import test from 'node:test';
import assert from 'node:assert/strict';
import { createD1Database } from './helpers/d1.js';

async function planDetails(DB, sql, values = []) {
  const result = await DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...values).all();
  return (result.results || []).map(row => String(row.detail || '')).join(' | ');
}

test('representative household list queries use matching composite indexes', async () => {
  const DB = createD1Database();
  const trips = await planDetails(DB, 'SELECT id FROM trips WHERE household_id = ? ORDER BY start_date DESC, id DESC LIMIT 50', [1]);
  const journeys = await planDetails(DB, 'SELECT id FROM journeys WHERE household_id = ? ORDER BY start_date DESC, id DESC LIMIT 20', [1]);
  const photos = await planDetails(DB, 'SELECT id FROM photos WHERE household_id = ? AND trip_id = ? ORDER BY is_cover DESC, sort_order, id LIMIT 100', [1, 1]);
  assert.match(trips, /idx_trips_household_start_date(?:_id)?/);
  assert.match(journeys, /idx_journeys_household_start_date_id/);
  assert.match(photos, /idx_photos_household_trip_cover_sort/);
  DB.close();
});
