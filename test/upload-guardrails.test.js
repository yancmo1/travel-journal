import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveUploadSlots, uploadQuotaExceeded } from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';

test('upload quota guardrails account only for new bytes and new uploads', () => {
  const baseline = {
    currentStorageBytes: 900,
    incomingBytes: 100,
    maxStorageBytes: 1000,
    dailyUploadCount: 4,
    dailyUploadBytes: 400,
    newUploadCount: 1,
    maxUploadsPerDay: 5,
    maxUploadBytesPerDay: 500,
  };
  assert.equal(uploadQuotaExceeded(baseline), false);
  assert.equal(uploadQuotaExceeded({ ...baseline, incomingBytes: 101 }), true);
  assert.equal(uploadQuotaExceeded({ ...baseline, newUploadCount: 2 }), true);
  assert.equal(uploadQuotaExceeded({ ...baseline, dailyUploadBytes: 401 }), true);
  assert.equal(uploadQuotaExceeded({ ...baseline, maxStorageBytes: 0, maxUploadsPerDay: 0, maxUploadBytesPerDay: 0 }), false);
});

test('D1 upload reservations prevent concurrent requests from bypassing quota', async () => {
  const DB = createD1Database();
  await DB.batch([
    DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind('quota-owner', 'hash'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('quota-household', 'Quota Household'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('Quota trip'),
  ]);
  const env = { DB };
  const first = await reserveUploadSlots(env, {
    householdId: 1,
    tripId: 1,
    reservationToken: 'attempt-one',
    maxStorageBytes: 1000,
    maxUploadsPerDay: 0,
    maxUploadBytesPerDay: 0,
    uploads: [{ clientUploadId: 'photo-one', fileSize: 700, mimeType: 'image/jpeg' }],
  });
  assert.equal(first.ok, true);
  const second = await reserveUploadSlots(env, {
    householdId: 1,
    tripId: 1,
    reservationToken: 'attempt-two',
    maxStorageBytes: 1000,
    maxUploadsPerDay: 0,
    maxUploadBytesPerDay: 0,
    uploads: [{ clientUploadId: 'photo-two', fileSize: 400, mimeType: 'image/jpeg' }],
  });
  assert.equal(second.ok, false);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM upload_reservations').first()).count, 1);
  DB.close();
});
