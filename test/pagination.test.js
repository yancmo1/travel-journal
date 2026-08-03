import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePageCursor, encodePageCursor } from '../worker/sites-static.js';

test('pagination cursors are opaque, bounded, and round-trip structured values', () => {
  const value = { date: '2024-06-01', id: 42 };
  const cursor = encodePageCursor(value);
  assert.match(cursor, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePageCursor(cursor), value);
  assert.equal(decodePageCursor('not-a-valid-json-cursor'), null);
  assert.equal(decodePageCursor('x'.repeat(513)), null);
});
