import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanupExpiredDataExports, cleanupExpiredPhotoUploadSessions } from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

test('scheduled cleanup removes expired operational rows without touching live cache state', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  await DB.batch([
    DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind('cleanup-owner', 'hash'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('cleanup-household', 'Cleanup Household'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('Cleanup trip'),
    DB.prepare('INSERT INTO idempotency_keys (scope_key, request_hash, expires_at) VALUES (?, ?, ?)').bind('expired', 'hash', '2000-01-01T00:00:00Z'),
    DB.prepare('INSERT INTO idempotency_keys (scope_key, request_hash, expires_at) VALUES (?, ?, ?)').bind('live', 'hash', '2999-01-01T00:00:00Z'),
    DB.prepare('INSERT INTO provider_cache (cache_key, provider, value, expires_at) VALUES (?, ?, ?, ?)').bind('expired-cache', 'test', '{}', '2000-01-01T00:00:00Z'),
    DB.prepare('INSERT INTO provider_cache (cache_key, provider, value, expires_at) VALUES (?, ?, ?, ?)').bind('live-cache', 'test', '{}', '2999-01-01T00:00:00Z'),
    DB.prepare('INSERT INTO auth_rate_limits (key, action, attempts, window_started_at) VALUES (?, ?, ?, ?)').bind('old-limit', 'test', 1, '2000-01-01T00:00:00Z'),
    DB.prepare(`INSERT INTO photo_upload_sessions
      (id, household_id, trip_id, client_upload_id, reservation_token, original_key, original_filename, mime_type, original_bytes, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind('expired-session', 1, 1, 'expired-upload', 'expired-token', 'households/1/trips/1/original/expired.jpg', 'expired.jpg', 'image/jpeg', 5, 'pending', '2000-01-01T00:00:00Z'),
    DB.prepare(`INSERT INTO upload_reservations
      (id, household_id, trip_id, client_upload_id, reservation_token, file_size, mime_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind('expired-reservation', 1, 1, 'expired-upload', 'expired-token', 5, 'image/jpeg', '2000-01-01T00:00:00Z'),
    DB.prepare(`INSERT INTO data_exports (id, household_id, requested_by, status, phase, manifest_key, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind('expired-export', 1, 1, 'completed', 'complete', '_exports/households/1/expired-export/manifest.json', '2000-01-01T00:00:00Z'),
  ]);
  await MEDIA.put('households/1/trips/1/original/expired.jpg', new TextEncoder().encode('stale'));
  await MEDIA.put('_exports/households/1/expired-export/manifest.json', new TextEncoder().encode('{}'));
  await MEDIA.put('_exports/households/1/expired-export/media/1/original.jpg', new TextEncoder().encode('stale-export'));
  assert.equal(await cleanupExpiredPhotoUploadSessions({ DB, MEDIA }), 1);
  assert.equal(await MEDIA.head('households/1/trips/1/original/expired.jpg'), null);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM upload_reservations').first()).count), 0);
  assert.equal(await cleanupExpiredDataExports({ DB, MEDIA }), 1);
  assert.equal(await MEDIA.head('_exports/households/1/expired-export/manifest.json'), null);
  const waits = [];
  await worker.scheduled({}, { DB, MEDIA, ENABLE_BACKGROUND_JOBS: 'true', ENABLE_AUTOMATIC_BACKUPS: 'false' }, { waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM idempotency_keys WHERE scope_key = ?').bind('expired').first()).count), 0);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM idempotency_keys WHERE scope_key = ?').bind('live').first()).count), 1);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM provider_cache WHERE cache_key = ?').bind('expired-cache').first()).count), 0);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM provider_cache WHERE cache_key = ?').bind('live-cache').first()).count), 1);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM auth_rate_limits WHERE key = ?').bind('old-limit').first()).count), 0);
  DB.close();
});
