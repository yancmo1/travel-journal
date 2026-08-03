#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function args(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply' || value === '--allow-production') values[value.slice(2)] = true;
    else if (value.startsWith('--')) {
      const [key, inline] = value.slice(2).split('=', 2);
      values[key] = inline ?? argv[++index];
    }
  }
  return values;
}

function required(values, key) {
  if (!values[key]) throw new Error(`Missing --${key}`);
  return values[key];
}

async function readJsonl(file) {
  const body = await readFile(file, 'utf8');
  return body.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function chunks(rows, size = 100) {
  const output = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
}

async function requestJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}: ${body.error || body.raw || 'unknown error'}`);
  return body;
}

function safeSourcePath(value) {
  const normalized = path.posix.normalize(String(value || '').replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) throw new Error(`Unsafe source path ${value}`);
  return normalized;
}

const values = args(process.argv);
const baseUrl = required(values, 'base-url').replace(/\/$/, '');
const token = String(values.token || process.env.MIGRATION_TOKEN || '');
const artifacts = path.resolve(required(values, 'artifacts'));
const mediaRoot = path.resolve(required(values, 'media-root'));
const hostname = new URL(baseUrl).hostname;
if (hostname === 'postcardsofus.com' && !values['allow-production']) {
  throw new Error('Refusing to write migration data to postcardsofus.com without --allow-production. Use a staging hostname for rehearsal.');
}
if (!token) throw new Error('Provide --token or MIGRATION_TOKEN.');

const headers = { 'x-migration-token': token };
const statusUrl = `${baseUrl}/api/migration/status`;
const before = await requestJson(statusUrl, { headers }, 'Migration status');
console.log(`Target before import: ${before.mediaObjects} media objects`);

const mediaRows = await readJsonl(path.join(artifacts, 'media-upload.jsonl'));
const manifest = new Map();
const manifestPath = path.join(artifacts, 'media-manifest.tsv');
try {
  const text = await readFile(manifestPath, 'utf8');
  for (const line of text.split(/\r?\n/).slice(1).filter(Boolean)) {
    const [sourcePath, bytes, sha256, mimeType] = line.split('\t');
    manifest.set(sourcePath, { bytes: Number(bytes), sha256, mimeType });
  }
} catch {
  throw new Error(`Missing ${manifestPath}; refusing to upload without source checksums.`);
}
const expectedMediaBytes = mediaRows.reduce((sum, row) => sum + Number(manifest.get(row.source_path)?.bytes || 0), 0);

if (!values.apply) {
  console.log(`Dry run: ${mediaRows.length} media objects and database artifacts are ready. Re-run with --apply to write.`);
  process.exit(0);
}

const tableOrder = ['households', 'users', 'household_members', 'travelers', 'journeys', 'trips', 'trip_travelers', 'photos'];
const targetHasRows = Object.values(before.counts || {}).some(count => Number(count) > 0) || Number(before.mediaObjects || 0) > 0;
if (targetHasRows && !values['allow-existing-target']) {
  throw new Error('Refusing to apply to a non-empty target. Use a fresh staging target or explicitly pass --allow-existing-target after review.');
}

for (let index = 0; index < mediaRows.length; index += 1) {
  const row = mediaRows[index];
  const sourcePath = safeSourcePath(row.source_path);
  const filePath = path.resolve(mediaRoot, sourcePath);
  if (!filePath.startsWith(`${mediaRoot}${path.sep}`)) throw new Error(`Source path escaped media root: ${sourcePath}`);
  const bytes = await readFile(filePath);
  const expected = manifest.get(sourcePath);
  if (!expected) throw new Error(`No checksum manifest entry for ${sourcePath}`);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expected.sha256 || bytes.byteLength !== expected.bytes) throw new Error(`Checksum/size mismatch for ${sourcePath}`);
  await requestJson(`${baseUrl}/api/migration/media/${encodeURIComponent(row.target_key)}`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': row.mime_type || expected.mimeType || 'application/octet-stream', 'x-source-sha256': expected.sha256 },
    body: bytes,
  }, `Media ${index + 1}/${mediaRows.length}`);
}
console.log(`Uploaded and verified ${mediaRows.length} media objects.`);

const expectedCounts = {};
for (const table of tableOrder) {
  const file = path.join(artifacts, 'database', `${table}.jsonl`);
  const rows = await readJsonl(file);
  expectedCounts[table] = rows.length;
  let imported = 0;
  for (const batch of chunks(rows)) {
    const result = await requestJson(`${baseUrl}/api/migration/import`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ table, rows: batch }),
    }, `Database ${table}`);
    imported += Number(result.imported || 0);
  }
  console.log(`Imported ${imported} ${table} rows.`);
}

const after = await requestJson(statusUrl, { headers }, 'Migration status');
console.log(`Target after import: ${after.mediaObjects} media objects`);
console.log(JSON.stringify(after.counts, null, 2));
for (const table of tableOrder) {
  const received = Number(after.counts?.[table] || 0);
  const mismatch = values['allow-existing-target'] ? received < expectedCounts[table] : received !== expectedCounts[table];
  if (mismatch) {
    throw new Error(`Target count mismatch for ${table}: expected ${expectedCounts[table]}, received ${after.counts?.[table] || 0}`);
  }
}
if ((values['allow-existing-target'] && Number(after.mediaObjects || 0) < mediaRows.length)
  || (!values['allow-existing-target'] && Number(after.mediaObjects || 0) !== mediaRows.length)) {
  throw new Error(`Target media count mismatch: expected ${mediaRows.length}, received ${after.mediaObjects || 0}`);
}
if (!values['allow-existing-target'] && Number(after.mediaBytes || 0) !== expectedMediaBytes) {
  throw new Error(`Target media byte mismatch: expected ${expectedMediaBytes}, received ${after.mediaBytes || 0}`);
}
