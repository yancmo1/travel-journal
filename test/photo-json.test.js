import test from 'node:test';
import assert from 'node:assert/strict';
import { photoJson } from '../worker/sites-static.js';

test('pending processing photos never expose the original as a thumbnail', () => {
  const pending = photoJson({
    id: 1,
    trip_id: 2,
    r2_key: 'households/1/trips/2/original/photo.heic',
    display_r2_key: null,
    thumbnail_r2_key: null,
    processing_status: 'pending_processing',
    original_filename: 'photo.heic',
  });
  assert.equal(pending.file_path, 'households/1/trips/2/original/photo.heic');
  assert.equal(pending.thumbnail_path, null);

  const legacyReady = photoJson({
    id: 2,
    trip_id: 2,
    r2_key: 'households/1/trips/2/original/photo.jpg',
    display_r2_key: null,
    thumbnail_r2_key: null,
    processing_status: 'ready',
    original_filename: 'photo.jpg',
  });
  assert.equal(legacyReady.thumbnail_path, legacyReady.file_path);
});
