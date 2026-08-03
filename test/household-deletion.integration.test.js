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

async function seeded() {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('delete-owner', 'delete-owner@example.com', passwordHash, 'Delete Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('delete-family', 'Delete Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('Delete Place'),
    DB.prepare('INSERT INTO photos (household_id, trip_id, r2_key, original_filename, file_size, mime_type) VALUES (1, 1, ?, ?, ?, ?)').bind('households/1/trips/1/original/delete.jpg', 'delete.jpg', 13, 'image/jpeg'),
  ]);
  await MEDIA.put('households/1/trips/1/original/delete.jpg', new TextEncoder().encode('delete-bytes'), { httpMetadata: { contentType: 'image/jpeg' } });
  return { DB, MEDIA };
}

test('household deletion is fail-closed by default', async () => {
  const env = await seeded();
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'delete-owner@example.com', password: 'correct horse battery staple' }),
  }), env, { waitUntil() {} });
  const response = await worker.fetch(request('/api/households/current/deletion', {
    method: 'POST',
    headers: { cookie: cookieFrom(login), 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'Delete Family' }),
  }), env, { waitUntil() {} });
  assert.equal(response.status, 503);
  assert.equal(Number((await env.DB.prepare('SELECT COUNT(*) AS count FROM data_deletions').first()).count), 0);
  env.DB.close();
});

test('enabled household deletion locks writes, removes media, and records completion', async () => {
  const env = await seeded();
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'delete-owner@example.com', password: 'correct horse battery staple' }),
  }), env, { waitUntil() {} });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const deletionRequest = {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'household-delete-retry-1' },
    body: JSON.stringify({ confirmation: 'Delete Family' }),
  };
  const queued = await worker.fetch(request('/api/households/current/deletion', deletionRequest), { ...env, ENABLE_HOUSEHOLD_DELETION: 'true' }, { waitUntil() {} });
  assert.equal(queued.status, 202);
  const lockedWrite = await worker.fetch(request('/api/trips', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ locationName: 'Should be blocked' }),
  }), { ...env, ENABLE_HOUSEHOLD_DELETION: 'true' }, { waitUntil() {} });
  assert.equal(lockedWrite.status, 423);
  const waits = [];
  await worker.scheduled({}, { ...env, ENABLE_BACKGROUND_JOBS: 'true', ENABLE_AUTOMATIC_BACKUPS: 'false' }, { waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
  assert.equal(await env.MEDIA.head('households/1/trips/1/original/delete.jpg'), null);
  const deletion = await env.DB.prepare('SELECT status, phase, household_id, media_deleted FROM data_deletions WHERE id = ?').bind((await queued.json()).deletion_id).first();
  assert.equal(deletion.status, 'completed');
  assert.equal(deletion.phase, 'complete');
  assert.equal(deletion.household_id, null);
  assert.equal(Number(deletion.media_deleted), 1);
  assert.equal(await env.DB.prepare('SELECT id FROM households WHERE id = 1').first(), null);
  env.DB.close();
});
