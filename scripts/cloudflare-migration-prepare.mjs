#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

function args(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const [key, inline] = value.slice(2).split('=', 2);
    values[key] = inline ?? argv[++index];
  }
  return values;
}

function required(values, key) {
  if (!values[key]) throw new Error(`Missing --${key}`);
  return path.resolve(values[key]);
}

async function readJsonl(file) {
  const rows = [];
  const stream = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of stream) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

async function writeJsonl(file, rows) {
  const body = rows.length ? `${rows.map(row => JSON.stringify(row)).join('\n')}\n` : '';
  await writeFile(file, body, 'utf8');
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function safeRelative(value) {
  const normalized = path.posix.normalize(String(value || '').replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe legacy media path: ${value}`);
  }
  return normalized;
}

function basename(value) {
  return path.posix.basename(safeRelative(value));
}

function mimeFor(value) {
  const extension = path.posix.extname(value).toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  }[extension] || 'application/octet-stream';
}

function mediaTarget(householdId, tripId, variant, sourcePath) {
  const extension = path.posix.extname(sourcePath).toLowerCase().replace('.', '') || 'bin';
  const stem = basename(sourcePath).replace(/\.[^.]+$/, '');
  return `households/${householdId}/trips/${tripId}/${variant}/${stem.replace(/[^a-zA-Z0-9._-]/g, '_')}.${extension}`;
}

const values = args(process.argv);
const input = required(values, 'input');
const output = required(values, 'output');
const householdId = Number(values['household-id'] || 1);
const householdName = String(values['household-name'] || 'Legacy Family').trim();
if (!Number.isInteger(householdId) || householdId < 1) throw new Error('--household-id must be a positive integer');

const database = name => readJsonl(path.join(input, 'database', `${name}.jsonl`));
const [sourceUsers, sourceTravelers, sourceJourneys, sourceTrips, sourceTripTravelers, sourcePhotos] = await Promise.all([
  database('users'), database('travelers'), database('journeys'), database('trips'), database('trip_travelers'), database('photos'),
]);
const mediaManifestText = await readFile(path.join(input, 'media-manifest.tsv'), 'utf8');
const availableMedia = new Set(mediaManifestText.split(/\r?\n/).slice(1).filter(Boolean).map(line => line.split('\t', 1)[0]));

const outputDatabase = path.join(output, 'database');
await mkdir(outputDatabase, { recursive: true });
await writeFile(path.join(output, 'media-manifest.tsv'), mediaManifestText, 'utf8');
const createdAt = new Date().toISOString();
const userIds = new Set(sourceUsers.map(row => Number(row.id)));
const tripIds = new Set(sourceTrips.map(row => Number(row.id)));

const households = [{ id: householdId, slug: 'legacy-family', name: householdName, created_at: createdAt, updated_at: createdAt }];
const users = sourceUsers.map(row => ({
  id: Number(row.id),
  username: row.username,
  email: row.email || null,
  email_verified_at: row.email ? (row.email_verified_at || null) : null,
  site_admin: row.site_admin ? 1 : 0,
  password_hash: row.password_hash,
  password_updated_at: null,
  display_name: row.display_name || row.username,
  created_at: iso(row.created_at) || createdAt,
}));
const householdMembers = users.map((row, index) => ({
  household_id: householdId,
  user_id: row.id,
  role: index === 0 || row.site_admin ? 'owner' : 'member',
  created_at: createdAt,
}));
const travelers = sourceTravelers.map(row => ({
  id: Number(row.id), household_id: householdId, name: row.name, relationship: row.relationship || 'other',
  is_active: row.is_active === false ? 0 : 1, created_at: iso(row.created_at) || createdAt,
}));
const journeys = sourceJourneys.map(row => ({
  id: Number(row.id), household_id: householdId, title: row.title, start_date: row.start_date || null,
  end_date: row.end_date || null, date_label: row.date_label || null, journey_type: row.journey_type || 'Other',
  summary: row.summary || null, cover_photo_id: row.cover_photo_id || null, share_token: row.share_token || null,
  share_expires_at: iso(row.share_expires_at), created_by: userIds.has(Number(row.created_by)) ? Number(row.created_by) : null,
  created_at: iso(row.created_at) || createdAt, updated_at: iso(row.updated_at) || iso(row.created_at) || createdAt,
}));
const trips = sourceTrips.map(row => ({
  id: Number(row.id), household_id: householdId, location_name: row.location_name || 'Unknown Location', city: row.city || null,
  latitude: row.latitude ?? null, longitude: row.longitude ?? null, country: row.country || null, state: row.state || null,
  start_date: row.start_date || null, end_date: row.end_date || null, date_label: row.date_label || null,
  date_precision: row.date_precision || 'exact', trip_type: row.trip_type || 'Other', notes: row.notes || null,
  journey_id: row.journey_id && journeys.some(journey => journey.id === Number(row.journey_id)) ? Number(row.journey_id) : null,
  journey_order: row.journey_order ?? null, home_distance_miles: row.home_distance_miles ?? null,
  created_by: userIds.has(Number(row.created_by)) ? Number(row.created_by) : null,
  created_at: iso(row.created_at) || createdAt, updated_at: iso(row.updated_at) || iso(row.created_at) || createdAt,
}));
const tripTravelers = sourceTripTravelers
  .filter(row => tripIds.has(Number(row.trip_id)) && sourceTravelers.some(traveler => Number(traveler.id) === Number(row.traveler_id)))
  .map(row => ({ trip_id: Number(row.trip_id), traveler_id: Number(row.traveler_id) }));

const mediaRows = [];
const photos = sourcePhotos.map(row => {
  const tripId = Number(row.trip_id);
  if (!tripIds.has(tripId)) throw new Error(`Photo ${row.id} references missing trip ${row.trip_id}`);
  const originalPath = safeRelative(row.file_path);
  const preferredDisplayPath = row.medium_path
    ? safeRelative(row.medium_path)
    : safeRelative(originalPath.replace('/original/', '/medium/'));
  const displayPath = availableMedia.has(preferredDisplayPath) ? preferredDisplayPath : originalPath;
  const preferredThumbnailPath = row.thumbnail_path ? safeRelative(row.thumbnail_path) : safeRelative(originalPath.replace('/original/', '/thumbnails/'));
  const thumbnailPath = availableMedia.has(preferredThumbnailPath) ? preferredThumbnailPath : originalPath;
  const originalKey = mediaTarget(householdId, tripId, 'original', originalPath);
  const displayKey = displayPath !== originalPath ? mediaTarget(householdId, tripId, 'display', displayPath) : null;
  const thumbnailKey = thumbnailPath !== originalPath ? mediaTarget(householdId, tripId, 'thumbnail', thumbnailPath) : null;
  mediaRows.push({ photo_id: Number(row.id), source_path: originalPath, target_key: originalKey, variant: 'original', mime_type: mimeFor(originalPath) });
  if (displayKey) mediaRows.push({ photo_id: Number(row.id), source_path: displayPath, target_key: displayKey, variant: 'display', mime_type: mimeFor(displayPath) });
  if (thumbnailKey) mediaRows.push({ photo_id: Number(row.id), source_path: thumbnailPath, target_key: thumbnailKey, variant: 'thumbnail', mime_type: mimeFor(thumbnailPath) });
  const processingStatus = displayKey && thumbnailKey ? 'ready' : 'pending_processing';
  return {
    id: Number(row.id), household_id: householdId, trip_id: tripId, client_upload_id: null, r2_key: originalKey, display_r2_key: displayKey,
    thumbnail_r2_key: thumbnailKey, original_filename: row.filename || basename(originalPath), file_size: row.file_size ?? null,
    mime_type: row.mime_type || mimeFor(originalPath), processing_status: processingStatus, processing_version: 1,
    metadata_source: 'legacy-import', date_taken: iso(row.date_taken), latitude: row.latitude ?? null, longitude: row.longitude ?? null,
    caption: row.caption || null, sort_order: Number(row.sort_order || 0), is_cover: row.is_cover ? 1 : 0,
    rotation: Number(row.rotation || 0), uploaded_at: iso(row.uploaded_at) || createdAt,
  };
});

const tableRows = { households, users, household_members: householdMembers, travelers, journeys, trips, trip_travelers: tripTravelers, photos };
for (const [table, rows] of Object.entries(tableRows)) await writeJsonl(path.join(outputDatabase, `${table}.jsonl`), rows);
await writeJsonl(path.join(output, 'media-upload.jsonl'), [...new Map(mediaRows.map(row => [`${row.source_path}\u0000${row.target_key}`, row])).values()]);
await writeFile(path.join(output, 'prepare-summary.json'), JSON.stringify({
  format: 'postcards-cloudflare-import', version: 1, created_at: createdAt, household_id: householdId,
  counts: Object.fromEntries(Object.entries(tableRows).map(([table, rows]) => [table, rows.length])), media_objects: mediaRows.length,
}, null, 2) + '\n');

console.log(`Prepared Cloudflare import artifacts at ${output}`);
