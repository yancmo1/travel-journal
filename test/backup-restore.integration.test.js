import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup } from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

async function insertRows(DB, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(',');
    await DB.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`).bind(...columns.map(column => row[column])).run();
  }
}

test('local backup restore preserves structured rows and private media bytes', async () => {
  const sourceDB = createD1Database();
  const sourceMEDIA = new MemoryR2();
  await sourceDB.batch([
    sourceDB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('restore-family', 'Restore Family'),
    sourceDB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('restore@example.com', 'restore@example.com', 'test-hash', 'Restore Owner'),
    sourceDB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    sourceDB.prepare('INSERT INTO travelers (household_id, name, relationship) VALUES (1, ?, ?)').bind('Traveler', 'spouse'),
    sourceDB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('Restored Place'),
    sourceDB.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (1, 1)'),
    sourceDB.prepare("INSERT INTO data_exports (id, household_id, requested_by, expires_at) VALUES (?, 1, 1, datetime('now', '+1 day'))").bind('export-1'),
    sourceDB.prepare("INSERT INTO data_deletions (id, household_id, target_household_id, requested_by) VALUES (?, 1, 1, 1)").bind('deletion-1'),
    sourceDB.prepare('INSERT INTO audit_events (id, user_id, household_id, action) VALUES (?, 1, 1, ?)').bind('audit-1', 'restore.test'),
  ]);
  await sourceMEDIA.put('households/1/trips/1/original/photo.jpg', new TextEncoder().encode('private-photo-bytes'), { httpMetadata: { contentType: 'image/jpeg' } });

  const source = { DB: sourceDB, MEDIA: sourceMEDIA };
  const manifest = await createBackup(source, { force: true });
  assert.equal(manifest.databaseTableCounts.households, 1);
  assert.equal(manifest.databaseTableCounts.photos, 0);
  assert.equal(manifest.sourcePhotoObjects, 1);
  assert.ok(manifest.databaseSha256);
  assert.ok(manifest.mediaManifestSha256);

  const databaseSnapshot = JSON.parse(await (await sourceMEDIA.get(manifest.databaseKey)).text());
  const mediaManifest = JSON.parse(await (await sourceMEDIA.get(manifest.mediaManifestKey)).text());
  const restoredDB = createD1Database();
  const restoredMEDIA = new MemoryR2();
  const restoreOrder = ['households', 'users', 'household_members', 'travelers', 'journeys', 'trips', 'trip_travelers', 'photos', 'data_exports', 'data_deletions', 'jobs', 'audit_events', 'provider_cache', 'idempotency_keys'];
  for (const table of restoreOrder) await insertRows(restoredDB, table, databaseSnapshot.database.tables[table] || []);
  for (const object of mediaManifest.objects) {
    const archived = await sourceMEDIA.get(object.backupKey);
    await restoredMEDIA.put(object.key, await archived.arrayBuffer(), { httpMetadata: archived.httpMetadata });
  }

  const restoredCounts = await restoredDB.batch(restoreOrder.map(table => restoredDB.prepare(`SELECT COUNT(*) AS count FROM ${table}`)));
  for (let index = 0; index < restoreOrder.length; index += 1) {
    assert.equal(Number(restoredCounts[index].results[0].count), Number(manifest.databaseTableCounts[restoreOrder[index]] || 0));
  }
  const restoredPhoto = await restoredMEDIA.get('households/1/trips/1/original/photo.jpg');
  assert.equal(await restoredPhoto.text(), 'private-photo-bytes');
  assert.equal((await sourceMEDIA.list({ prefix: 'households/' })).objects.length, (await restoredMEDIA.list()).objects.length);
  sourceDB.close();
  restoredDB.close();
});
