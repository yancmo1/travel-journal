import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function writeJsonl(file, rows) {
  await writeFile(file, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

test('migration preparation maps legacy records and media to one household', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'postcards-migration-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  await mkdir(path.join(input, 'database'), { recursive: true });
  const files = {
    users: [{ id: 1, username: 'yancy@example.com', email: 'yancy@example.com', password_hash: 'bcrypt', site_admin: true, created_at: '2024-01-01T00:00:00Z' }],
    travelers: [{ id: 2, name: 'Amber', relationship: 'wife', is_active: true, created_at: '2024-01-01T00:00:00Z' }],
    journeys: [{ id: 3, title: 'Test Journey', created_by: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }],
    trips: [{ id: 4, location_name: 'Test Place', journey_id: 3, created_by: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }],
    trip_travelers: [{ trip_id: 4, traveler_id: 2 }],
    photos: [{ id: 5, trip_id: 4, filename: 'photo.jpg', file_path: '4/original/photo.jpg', thumbnail_path: '4/thumbnails/photo.jpg', file_size: 10, mime_type: 'image/jpeg', created_at: '2024-01-01T00:00:00Z' }],
    households: [], household_members: [], invitations: [],
  };
  for (const [table, rows] of Object.entries(files)) await writeJsonl(path.join(input, 'database', `${table}.jsonl`), rows);
  await writeFile(path.join(input, 'media-manifest.tsv'), [
    'source_path\tbytes\tsha256\tmime_type',
    '4/original/photo.jpg\t10\toriginal-hash\timage/jpeg',
    '4/medium/photo.jpg\t10\tdisplay-hash\timage/jpeg',
    '4/thumbnails/photo.jpg\t10\tthumbnail-hash\timage/jpeg',
  ].join('\n') + '\n');

  try {
    await execFileAsync(process.execPath, [
      'scripts/cloudflare-migration-prepare.mjs', '--input', input, '--output', output,
      '--household-id', '9', '--household-name', 'Test Family',
    ], { cwd: path.resolve('.') });
    const preparedPhotos = (await readFile(path.join(output, 'database', 'photos.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const mediaRows = (await readFile(path.join(output, 'media-upload.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(preparedPhotos.length, 1);
    assert.equal(preparedPhotos[0].household_id, 9);
    assert.equal(preparedPhotos[0].r2_key, 'households/9/trips/4/original/photo.jpg');
    assert.equal(preparedPhotos[0].display_r2_key, 'households/9/trips/4/display/photo.jpg');
    assert.equal(preparedPhotos[0].thumbnail_r2_key, 'households/9/trips/4/thumbnail/photo.jpg');
    assert.equal(mediaRows.length, 3);
    assert.equal(JSON.parse((await readFile(path.join(output, 'prepare-summary.json'), 'utf8'))).counts.households, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
