export const BACKUP_PREFIX = '_backups/';

export function isSafeMediaKey(key) {
  return Boolean(key) && !key.includes('..') && !key.startsWith(BACKUP_PREFIX);
}

export function uploadMediaKey({ householdId, tripId, variant = 'original', extension = 'bin', id }) {
  if (!Number.isInteger(Number(householdId)) || Number(householdId) < 1) throw new Error('Invalid household id');
  if (!Number.isInteger(Number(tripId)) || Number(tripId) < 1) throw new Error('Invalid trip id');
  if (!/^[a-z0-9_-]+$/i.test(variant)) throw new Error('Invalid media variant');
  if (!/^[a-z0-9]+$/i.test(extension)) throw new Error('Invalid media extension');
  if (!id || String(id).includes('/')) throw new Error('Invalid media id');
  return `households/${Number(householdId)}/trips/${Number(tripId)}/${variant}/${String(id)}.${extension}`;
}

export function distinctMediaKeys(rows = []) {
  return [...new Set(rows.flatMap(row => [row?.r2_key, row?.display_r2_key, row?.thumbnail_r2_key].filter(Boolean)))];
}

