import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

function request(url, options = {}) {
  return new Request(`https://postcardsofus.test${url}`, {
    ...options,
    headers: { origin: 'https://postcardsofus.test', ...(options.headers || {}) },
  });
}

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('household export runs as a bounded job and protects exported media', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('export-owner', 'export-owner@example.com', passwordHash, 'Export Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('export-family', 'Export Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('Export Place'),
    DB.prepare('INSERT INTO photos (household_id, trip_id, r2_key, original_filename, file_size, mime_type) VALUES (1, 1, ?, ?, ?, ?)').bind('households/1/trips/1/original/export.jpg', 'export.jpg', 12, 'image/jpeg'),
  ]);
  await MEDIA.put('households/1/trips/1/original/export.jpg', new TextEncoder().encode('export-bytes'), { httpMetadata: { contentType: 'image/jpeg' } });
  const env = { DB, MEDIA };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'export-owner@example.com', password: 'correct horse battery staple' }),
  }), env, { waitUntil() {} });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const exportRequest = {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'household-export-retry-1' },
    body: JSON.stringify({}),
  };
  const queued = await worker.fetch(request('/api/households/current/exports', exportRequest), env, { waitUntil() {} });
  assert.equal(queued.status, 202);
  const queuedBody = await queued.json();
  const replay = await worker.fetch(request('/api/households/current/exports', exportRequest), env, { waitUntil() {} });
  assert.equal(replay.status, 202);
  assert.equal(replay.headers.get('idempotent-replay'), 'true');
  assert.equal((await replay.json()).export_id, queuedBody.export_id);

  const waits = [];
  await worker.scheduled({}, { ...env, ENABLE_BACKGROUND_JOBS: 'true', ENABLE_AUTOMATIC_BACKUPS: 'false' }, { waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  const status = await worker.fetch(request(`/api/households/current/exports/${queuedBody.export_id}`, { headers: { cookie } }), env, { waitUntil() {} });
  assert.equal(status.status, 200);
  const statusBody = await status.json();
  assert.equal(statusBody.status, 'completed');
  assert.equal(statusBody.media_copied, 1);
  const download = await worker.fetch(request(`/api/households/current/exports/${queuedBody.export_id}/download`, { headers: { cookie } }), env, { waitUntil() {} });
  assert.equal(download.status, 200);
  const manifest = await download.json();
  assert.equal(manifest.media.length, 1);
  assert.equal(Object.hasOwn(manifest.media[0], 'source_key'), false);
  const media = await worker.fetch(request(`/api/households/current/exports/${queuedBody.export_id}/media/1/original`, { headers: { cookie } }), env, { waitUntil() {} });
  assert.equal(media.status, 200);
  assert.equal(await media.text(), 'export-bytes');
  DB.close();
});
