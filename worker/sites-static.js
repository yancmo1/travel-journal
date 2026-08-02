import bcrypt from 'bcryptjs';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const encoder = new TextEncoder();
const passwordIterations = 100000;

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

function base64url(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ id: user.id, username: user.username, iat: now, exp: now + 7 * 86400 }));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

async function verifyToken(token, secret) {
  const [header, payload, signature, extra] = String(token || '').split('.');
  if (!header || !payload || !signature || extra) throw new Error('Invalid token');
  const unsigned = `${header}.${payload}`;
  const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), decodeBase64url(signature), encoder.encode(unsigned));
  if (!valid) throw new Error('Invalid token');
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64url(payload)));
  if (!claims.id || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  return claims;
}

async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 128) return 'Use no more than 128 characters.';
  const common = ['password', 'postcards', '123456789012', 'qwertyuiop'];
  if (common.some(value => password.toLowerCase().includes(value))) return 'Choose a less predictable password.';
  return null;
}

function randomToken(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: passwordIterations }, key, 256);
  return `pbkdf2_sha256$${passwordIterations}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, storedHash) {
  if (String(storedHash || '').startsWith('pbkdf2_sha256$')) {
    const [, rawIterations, rawSalt, expected] = storedHash.split('$');
    const iterations = Number(rawIterations);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > passwordIterations || !rawSalt || !expected) return false;
    let bits;
    try {
      const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decodeBase64url(rawSalt), iterations }, key, 256));
    } catch (error) {
      console.error('Password verification failed safely', error);
      return false;
    }
    const actual = base64url(bits);
    if (actual.length !== expected.length) return false;
    let mismatch = 0;
    for (let index = 0; index < actual.length; index += 1) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
    return mismatch === 0;
  }
  return bcrypt.compare(password, storedHash);
}

function cookieValue(request, name) {
  const cookies = request.headers.get('cookie') || '';
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sessionCookie(token) {
  return `postcards_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`;
}

function clearSessionCookie() {
  return 'postcards_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

async function createSession(env, userId, requestedHouseholdId = null) {
  let householdId = requestedHouseholdId;
  if (householdId == null) {
    const membership = await env.DB.prepare('SELECT household_id FROM household_members WHERE user_id = ? ORDER BY created_at, household_id LIMIT 1').bind(userId).first();
    householdId = membership?.household_id || null;
  }
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, household_id, expires_at) VALUES (?, ?, ?, ?)').bind(tokenHash, userId, householdId, expiresAt).run();
  return { token, tokenHash, householdId, expiresAt };
}

async function userHouseholds(env, userId) {
  return (await env.DB.prepare(`
    SELECT h.id, h.slug, h.name, hm.role,
      (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count
    FROM household_members hm JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ? ORDER BY h.created_at, h.id
  `).bind(userId).all()).results || [];
}

async function authenticate(request, env) {
  const sessionToken = cookieValue(request, 'postcards_session');
  if (sessionToken) {
    const tokenHash = await sha256(sessionToken);
    const user = await env.DB.prepare(`
      SELECT u.id, u.username, u.email, u.email_verified_at, u.password_updated_at, u.display_name,
        s.token_hash AS session_token_hash, s.household_id,
        hm.role, h.name AS household_name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN household_members hm ON hm.user_id = u.id AND hm.household_id = s.household_id
      LEFT JOIN households h ON h.id = s.household_id
      WHERE s.token_hash = ? AND datetime(s.expires_at) > CURRENT_TIMESTAMP
      LIMIT 1
    `).bind(tokenHash).first();
    if (user && (user.household_id == null || user.role)) return user;
  }
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || !env.JWT_SECRET) return null;
  try {
    const claims = await verifyToken(authorization.slice(7), env.JWT_SECRET);
    const user = await env.DB.prepare(`
      SELECT u.id, u.username, u.email, u.email_verified_at, u.password_updated_at, u.display_name,
        hm.household_id, hm.role, h.name AS household_name
      FROM users u JOIN household_members hm ON hm.user_id = u.id
      JOIN households h ON h.id = hm.household_id
      WHERE u.id = ? LIMIT 1
    `).bind(claims.id).first();
    if (user?.password_updated_at && Date.parse(user.password_updated_at) > Number(claims.iat || 0) * 1000) return null;
    return user || null;
  } catch { return null; }
}

function migrationAuthorized(request, env) {
  if (!env.MIGRATION_TOKEN) return false;
  const supplied = request.headers.get('x-migration-token') || '';
  if (supplied.length !== env.MIGRATION_TOKEN.length) return false;
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index += 1) mismatch |= supplied.charCodeAt(index) ^ env.MIGRATION_TOKEN.charCodeAt(index);
  return mismatch === 0;
}

function secretAuthorized(request, secret, headerName) {
  if (!secret) return false;
  const supplied = request.headers.get(headerName) || '';
  if (supplied.length !== secret.length) return false;
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index += 1) mismatch |= supplied.charCodeAt(index) ^ secret.charCodeAt(index);
  return mismatch === 0;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function sendEmail(env, { to, subject, text, html, idempotencyKey }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('Email delivery is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    console.error('Email delivery failed', response.status, await response.text());
    throw new Error('Email delivery failed');
  }
  return response.json();
}

async function rateLimit(env, action, identifier, limit, windowSeconds) {
  const key = await sha256(`${action}:${identifier}`);
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT attempts, window_started_at FROM auth_rate_limits WHERE key = ?').bind(key).first();
  const started = Date.parse(existing?.window_started_at || '');
  if (!existing || !Number.isFinite(started) || now - started >= windowSeconds * 1000) {
    await env.DB.prepare(`
      INSERT INTO auth_rate_limits (key, action, attempts, window_started_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET action = excluded.action, attempts = 1, window_started_at = excluded.window_started_at
    `).bind(key, action, new Date(now).toISOString()).run();
    return true;
  }
  if (Number(existing.attempts) >= limit) return false;
  await env.DB.prepare('UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE key = ?').bind(key).run();
  return true;
}

function requestFingerprint(request, identifier = '') {
  return `${request.headers.get('cf-connecting-ip') || 'unknown'}:${identifier}`;
}

async function invitationByToken(env, rawToken) {
  if (!rawToken) return null;
  return env.DB.prepare(`
    SELECT i.*, h.name AS household_name, u.display_name AS inviter_name,
      EXISTS(SELECT 1 FROM users existing WHERE existing.email = i.email) AS account_exists
    FROM invitations i
    JOIN households h ON h.id = i.household_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token_hash = ? AND i.accepted_at IS NULL AND datetime(i.expires_at) > CURRENT_TIMESTAMP
    LIMIT 1
  `).bind(await sha256(rawToken)).first();
}

async function sendInvitationEmail(env, request, invitation, rawToken) {
  const origin = new URL(request.url).origin;
  const link = `${origin}/?invite=${encodeURIComponent(rawToken)}`;
  const inviter = invitation.inviter_name || 'Someone in your family';
  const household = invitation.household_name;
  return sendEmail(env, {
    to: invitation.email,
    subject: `${inviter} invited you to ${household} on Postcards of Us`,
    text: `${inviter} invited you to join ${household} on Postcards of Us. Create or connect your account: ${link}\n\nThis invitation expires in 7 days.`,
    html: `<p>${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(household)}</strong> on Postcards of Us.</p><p><a href="${escapeHtml(link)}">Accept the invitation</a></p><p>This invitation expires in 7 days.</p>`,
    idempotencyKey: `postcards-invite-${invitation.id}`,
  });
}

async function sendPasswordResetEmail(env, request, user, rawToken, tokenId) {
  const link = `${new URL(request.url).origin}/?reset=${encodeURIComponent(rawToken)}`;
  return sendEmail(env, {
    to: user.email,
    subject: 'Reset your Postcards of Us password',
    text: `Use this link to reset your Postcards of Us password: ${link}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
    html: `<p>Use the link below to reset your Postcards of Us password.</p><p><a href="${escapeHtml(link)}">Reset password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`,
    idempotencyKey: `postcards-reset-${tokenId}`,
  });
}

async function sendVerificationEmail(env, request, user, email, rawToken, tokenId) {
  const link = `${new URL(request.url).origin}/?verify-email=${encodeURIComponent(rawToken)}`;
  return sendEmail(env, {
    to: email,
    subject: 'Confirm your email for Postcards of Us',
    text: `Confirm this email address for your Postcards of Us account: ${link}\n\nThis link expires in one hour.`,
    html: `<p>Confirm <strong>${escapeHtml(email)}</strong> for ${escapeHtml(user.display_name || 'your Postcards of Us account')}.</p><p><a href="${escapeHtml(link)}">Confirm email</a></p><p>This link expires in one hour.</p>`,
    idempotencyKey: `postcards-verify-${tokenId}`,
  });
}

const backupPrefix = '_backups/';
const backupTables = ['users', 'households', 'household_members', 'invitations', 'travelers', 'journeys', 'trips', 'trip_travelers', 'photos'];

async function readLatestBackup(env) {
  const object = await env.MEDIA.get(`${backupPrefix}latest.json`);
  if (!object) return null;
  try { return JSON.parse(await object.text()); } catch { return null; }
}

async function listSourceMedia(env) {
  const objects = [];
  let cursor;
  do {
    const page = await env.MEDIA.list({ cursor });
    objects.push(...page.objects.filter(object => !object.key.startsWith(backupPrefix)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

function cleanEtag(etag) {
  return String(etag || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
}

async function createBackup(env, { force = false } = {}) {
  const existing = await readLatestBackup(env);
  const existingAge = existing?.lastSuccessfulBackupAt ? Date.now() - Date.parse(existing.lastSuccessfulBackupAt) : Infinity;
  if (!force && existingAge < 23 * 60 * 60 * 1000) return existing;

  const startedAt = new Date().toISOString();
  const queryResults = await env.DB.batch(backupTables.map(table => env.DB.prepare(`SELECT * FROM ${table}`)));
  const tables = Object.fromEntries(backupTables.map((table, index) => [table, queryResults[index].results || []]));
  const sourceMedia = await listSourceMedia(env);
  const media = [];
  let copiedObjects = 0;
  let copiedBytes = 0;
  let photoStorageBytes = 0;

  for (const object of sourceMedia) {
    photoStorageBytes += Number(object.size || 0);
    const encodedKey = base64url(object.key);
    const backupKey = `${backupPrefix}media/${encodedKey}/${cleanEtag(object.etag)}`;
    if (!(await env.MEDIA.head(backupKey))) {
      const source = await env.MEDIA.get(object.key);
      if (!source) throw new Error(`Source media disappeared during backup: ${object.key}`);
      await env.MEDIA.put(backupKey, source.body, {
        httpMetadata: source.httpMetadata,
        customMetadata: { sourceKey: object.key, sourceEtag: object.etag || '' },
      });
      copiedObjects += 1;
      copiedBytes += Number(object.size || 0);
    }
    media.push({ key: object.key, backupKey, etag: object.etag, size: Number(object.size || 0), uploaded: object.uploaded });
  }

  const snapshot = {
    format: 'postcards-cloudflare-backup',
    version: 1,
    createdAt: startedAt,
    database: { engine: 'Cloudflare D1', tables },
    media: { engine: 'Cloudflare R2', objects: media },
  };
  const snapshotBytes = encoder.encode(JSON.stringify(snapshot));
  const safeTimestamp = startedAt.replace(/[:.]/g, '-');
  const databaseKey = `${backupPrefix}database/${safeTimestamp}.json`;
  await env.MEDIA.put(databaseKey, snapshotBytes, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

  const manifest = {
    configured: true,
    stale: false,
    lastSuccessfulBackupAt: startedAt,
    lastDatabaseDumpAt: startedAt,
    databaseDumpBytes: snapshotBytes.byteLength,
    databaseKey,
    databaseTableCounts: Object.fromEntries(backupTables.map(table => [table, tables[table].length])),
    sourcePhotoObjects: sourceMedia.length,
    photoStorageBytes,
    protectedPhotoObjects: media.length,
    protectedPhotoBytes: photoStorageBytes,
    copiedObjects,
    copiedBytes,
    recovery: { database: 'Cloudflare D1 Time Travel plus R2 export', photos: 'Versioned R2 archive copies' },
  };
  await env.MEDIA.put(`${backupPrefix}latest.json`, encoder.encode(JSON.stringify(manifest)), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return manifest;
}

async function tripMediaKeys(env, tripId, photoRows = []) {
  const keys = new Set();
  for (const photo of photoRows) {
    if (photo.r2_key && !photo.r2_key.startsWith(backupPrefix)) keys.add(photo.r2_key);
    if (photo.thumbnail_r2_key && !photo.thumbnail_r2_key.startsWith(backupPrefix)) keys.add(photo.thumbnail_r2_key);
  }

  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix: `${tripId}/`, cursor });
    for (const object of page.objects) {
      if (!object.key.startsWith(backupPrefix)) keys.add(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return [...keys];
}

async function deleteMediaKeys(env, keys) {
  for (let index = 0; index < keys.length; index += 1000) {
    await env.MEDIA.delete(keys.slice(index, index + 1000));
  }
}

function backupStatus(manifest) {
  if (!manifest) {
    return {
      configured: true,
      stale: true,
      staleAfterHours: 30,
      lastSuccessfulBackupAt: null,
      message: 'The first private Cloudflare archive is being prepared.',
    };
  }
  const ageHours = Math.max(0, (Date.now() - Date.parse(manifest.lastSuccessfulBackupAt)) / 3600000);
  const stale = !Number.isFinite(ageHours) || ageHours > 30;
  return {
    ...manifest,
    configured: true,
    stale,
    staleAfterHours: 30,
    ageHours: Number.isFinite(ageHours) ? ageHours : null,
    checkedAt: new Date().toISOString(),
    message: stale
      ? 'The last app archive is older than expected. A refresh has been queued.'
      : 'Database recovery and private photo archive copies are current in Cloudflare.',
  };
}

function photoJson(row) {
  return {
    id: row.id,
    trip_id: row.trip_id,
    filename: row.original_filename,
    file_path: row.r2_key,
    thumbnail_path: row.thumbnail_r2_key,
    file_size: row.file_size,
    mime_type: row.mime_type,
    date_taken: row.date_taken,
    latitude: row.latitude,
    longitude: row.longitude,
    caption: row.caption,
    sort_order: row.sort_order,
    is_cover: Boolean(row.is_cover),
    rotation: row.rotation,
    uploaded_at: row.uploaded_at,
  };
}

function tripInput(body) {
  const locationName = String(body?.locationName || '').trim();
  if (!locationName || locationName.length > 200) return { error: 'Enter a location name.' };
  const numberOrNull = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  const datePrecision = ['exact', 'year', 'unknown'].includes(body?.datePrecision) ? body.datePrecision : 'exact';
  return {
    value: {
      locationName,
      city: String(body?.city || '').trim() || null,
      latitude: numberOrNull(body?.latitude),
      longitude: numberOrNull(body?.longitude),
      country: String(body?.country || '').trim() || null,
      state: String(body?.state || '').trim() || null,
      startDate: datePrecision === 'exact' ? body?.startDate || null : null,
      endDate: datePrecision === 'exact' ? body?.endDate || null : null,
      dateLabel: datePrecision === 'exact' ? null : String(body?.dateLabel || '').trim() || null,
      datePrecision,
      tripType: String(body?.tripType || 'Other').trim().slice(0, 80) || 'Other',
      notes: String(body?.notes || '').slice(0, 20000) || null,
      travelerIds: [...new Set((Array.isArray(body?.travelerIds) ? body.travelerIds : []).map(Number).filter(id => Number.isInteger(id) && id > 0))],
    },
  };
}

async function householdTravelerIds(env, householdId, requestedIds) {
  if (!requestedIds.length) return [];
  const placeholders = requestedIds.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`SELECT id FROM travelers WHERE household_id = ? AND id IN (${placeholders})`).bind(householdId, ...requestedIds).all()).results || [];
  return rows.map(row => row.id);
}

function uploadMetadata(formData) {
  try {
    const parsed = JSON.parse(String(formData.get('photoMetadata') || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function photoMimeType(file) {
  if (file.type) return String(file.type).toLowerCase();
  const extension = String(file.name || '').toLowerCase().split('.').pop();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }[extension] || '';
}

async function decorateTrips(env, householdId, conditions = '', values = []) {
  const trips = (await env.DB.prepare(`
    SELECT t.*, j.title AS journey_title FROM trips t
    LEFT JOIN journeys j ON j.id = t.journey_id AND j.household_id = t.household_id
    WHERE t.household_id = ? ${conditions}
    ORDER BY t.start_date DESC, t.id DESC
  `).bind(householdId, ...values).all()).results || [];
  if (!trips.length) return [];
  const tripIds = trips.map(trip => trip.id);
  const placeholders = tripIds.map(() => '?').join(',');
  const travelers = (await env.DB.prepare(`
    SELECT tt.trip_id, tr.id, tr.name, tr.relationship, tr.is_active, tr.created_at
    FROM trip_travelers tt JOIN travelers tr ON tr.id = tt.traveler_id
    WHERE tt.trip_id IN (${placeholders}) AND tr.household_id = ?
    ORDER BY tr.created_at, tr.id
  `).bind(...tripIds, householdId).all()).results || [];
  const photos = (await env.DB.prepare(`
    SELECT * FROM photos WHERE trip_id IN (${placeholders}) AND household_id = ?
    ORDER BY is_cover DESC, sort_order, date_taken, uploaded_at, id
  `).bind(...tripIds, householdId).all()).results || [];
  return trips.map(trip => ({
    ...trip,
    travelers: travelers.filter(item => item.trip_id === trip.id).map(({ trip_id: ignored, ...traveler }) => ({ ...traveler, is_active: Boolean(traveler.is_active) })),
    photos: photos.filter(item => item.trip_id === trip.id).map(photoJson),
  }));
}

async function journeys(env, householdId, publicToken = null) {
  let statement;
  if (publicToken) {
    statement = env.DB.prepare(`SELECT * FROM journeys WHERE share_token = ? AND (share_expires_at IS NULL OR datetime(share_expires_at) > CURRENT_TIMESTAMP) LIMIT 1`).bind(publicToken);
  } else {
    statement = env.DB.prepare(`SELECT * FROM journeys WHERE household_id = ? ORDER BY start_date DESC, id DESC`).bind(householdId);
  }
  const rows = publicToken ? [await statement.first()].filter(Boolean) : ((await statement.all()).results || []);
  if (!rows.length) return [];
  const allTrips = await decorateTrips(env, publicToken ? rows[0].household_id : householdId);
  return rows.map(row => ({
    ...row,
    memories: allTrips
      .filter(trip => trip.journey_id === row.id)
      .sort((a, b) => (a.journey_order ?? 999999) - (b.journey_order ?? 999999) || String(a.start_date || '').localeCompare(String(b.start_date || '')) || a.id - b.id),
  }));
}

function tripDuration(start, end) {
  if (!start) return 0;
  const first = Date.parse(start);
  const last = Date.parse(end || start);
  return Number.isFinite(first) && Number.isFinite(last) ? Math.max(1, Math.round((last - first) / 86400000) + 1) : 0;
}

function haversine(aLat, aLon, bLat, bLon) {
  const radius = 3958.8;
  const radians = value => Number(value) * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function analytics(trips, travelers) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentDecade = `${Math.floor(currentYear / 10) * 10}s`;
  const durations = trips.filter(trip => trip.start_date).map(trip => tripDuration(trip.start_date, trip.end_date));
  const ordered = trips.filter(trip => trip.latitude != null && trip.longitude != null).sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  let totalMiles = 0;
  for (let index = 1; index < ordered.length; index += 1) totalMiles += haversine(ordered[index - 1].latitude, ordered[index - 1].longitude, ordered[index].latitude, ordered[index].longitude);
  const tripsByYear = {};
  const tripsByDecade = {};
  const types = {};
  const months = {};
  const locations = {};
  for (const trip of trips) {
    types[trip.trip_type || 'Other'] = (types[trip.trip_type || 'Other'] || 0) + 1;
    locations[trip.location_name] = (locations[trip.location_name] || 0) + 1;
    if (trip.start_date) {
      const date = new Date(`${trip.start_date}T00:00:00Z`);
      const year = date.getUTCFullYear();
      const decade = `${Math.floor(year / 10) * 10}s`;
      tripsByYear[year] = (tripsByYear[year] || 0) + 1;
      tripsByDecade[decade] = (tripsByDecade[decade] || 0) + 1;
      months[date.getUTCMonth()] = (months[date.getUTCMonth()] || 0) + 1;
    }
  }
  const furthest = trips.filter(trip => trip.home_distance_miles != null).sort((a, b) => Number(b.home_distance_miles) - Number(a.home_distance_miles))[0];
  const topLocation = Object.entries(locations).sort((a, b) => b[1] - a[1])[0];
  const topMonth = Object.entries(months).sort((a, b) => b[1] - a[1])[0];
  const years = Object.keys(tripsByYear).map(Number);
  const travelerBreakdown = Object.fromEntries(travelers.map(traveler => [traveler.name, trips.filter(trip => trip.travelers.some(item => item.id === traveler.id)).length]));
  const internationalTrips = trips.filter(trip => trip.country && trip.country !== 'United States').length;
  const totalDays = durations.reduce((sum, value) => sum + value, 0);
  return {
    summary: { totalTrips: trips.length, uniqueLocations: Object.keys(locations).length, countries: new Set(trips.map(t => t.country).filter(Boolean)).size, states: new Set(trips.map(t => t.state).filter(Boolean)).size, totalDaysTraveled: totalDays, totalMiles: Math.round(totalMiles) },
    duration: { avgTripLength: durations.length ? Number((totalDays / durations.length).toFixed(1)) : 0, longestTrip: durations.length ? Math.max(...durations) : 0, shortestTrip: durations.length ? Math.min(...durations) : 0, totalDays },
    distance: { totalMiles: Math.round(totalMiles), milesThisYear: 0, milesThisDecade: 0, furthestFromHome: furthest ? { location: furthest.location_name, miles: Math.round(furthest.home_distance_miles) } : null },
    frequency: { tripsByYear, tripsByDecade, tripsThisYear: tripsByYear[currentYear] || 0, tripsThisDecade: tripsByDecade[currentDecade] || 0, busiestYear: years.sort((a, b) => (tripsByYear[b] || 0) - (tripsByYear[a] || 0))[0] || null, travelStreak: 0 },
    types,
    travelers: { breakdown: travelerBreakdown, coupleOnlyTrips: trips.filter(trip => trip.travelers.length === 2 && trip.travelers.some(t => t.relationship === 'husband') && trip.travelers.some(t => t.relationship === 'wife')).length },
    funStats: { mostVisited: topLocation ? { location: topLocation[0], count: topLocation[1] } : null, busiestMonth: topMonth ? { month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(topMonth[0])], count: topMonth[1] } : null, internationalPct: trips.length ? Number((internationalTrips / trips.length * 100).toFixed(1)) : 0, domesticTrips: trips.length - internationalTrips, internationalTrips },
  };
}

const importTables = {
  households: ['id', 'slug', 'name', 'created_at', 'updated_at'],
  users: ['id', 'username', 'password_hash', 'display_name', 'created_at'],
  household_members: ['household_id', 'user_id', 'role', 'created_at'],
  travelers: ['id', 'household_id', 'name', 'relationship', 'is_active', 'created_at'],
  journeys: ['id', 'household_id', 'title', 'start_date', 'end_date', 'date_label', 'journey_type', 'summary', 'cover_photo_id', 'share_token', 'share_expires_at', 'created_by', 'created_at', 'updated_at'],
  trips: ['id', 'household_id', 'location_name', 'city', 'latitude', 'longitude', 'country', 'state', 'start_date', 'end_date', 'date_label', 'date_precision', 'trip_type', 'notes', 'journey_id', 'journey_order', 'home_distance_miles', 'created_by', 'created_at', 'updated_at'],
  trip_travelers: ['trip_id', 'traveler_id'],
  photos: ['id', 'household_id', 'trip_id', 'r2_key', 'thumbnail_r2_key', 'original_filename', 'file_size', 'mime_type', 'date_taken', 'latitude', 'longitude', 'caption', 'sort_order', 'is_cover', 'rotation', 'uploaded_at'],
};

async function importRows(request, env) {
  const body = await parseJson(request);
  const columns = importTables[body?.table];
  if (!columns || !Array.isArray(body.rows) || body.rows.length > 100) return json({ error: 'Invalid import batch' }, { status: 400 });
  if (!body.rows.length) return json({ imported: 0 });
  const placeholders = columns.map(() => '?').join(',');
  const statements = body.rows.map(row => env.DB.prepare(`INSERT OR IGNORE INTO ${body.table} (${columns.join(',')}) VALUES (${placeholders})`).bind(...columns.map(column => row[column] ?? null)));
  await env.DB.batch(statements);
  return json({ imported: body.rows.length });
}

async function migrationStatus(env) {
  const tables = Object.keys(importTables);
  const results = await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`)));
  let objectCount = 0;
  let cursor;
  do {
    const page = await env.MEDIA.list({ cursor });
    objectCount += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return json({ counts: Object.fromEntries(tables.map((table, index) => [table, Number(results[index].results?.[0]?.count || 0)])), mediaObjects: objectCount });
}

async function health(env) {
  const tableChecks = ['users', 'households', 'travelers', 'journeys', 'trips', 'photos']
    .map(table => env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`));
  const results = await env.DB.batch(tableChecks);
  const counts = results.map(result => Number(result.results?.[0]?.count || 0));
  await env.MEDIA.head('__postcards_healthcheck__');

  return json({
    status: 'ok',
    database: 'connected',
    storage: 'connected',
    schema: 'ready',
    empty: counts.every(count => count === 0),
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        return await health(env);
      } catch (error) {
        console.error('Postcards health check failed', error);
        return json({ status: 'error', database: 'unavailable' }, { status: 503 });
      }
    }

    if (url.pathname.startsWith('/api/migration/')) {
      if (!migrationAuthorized(request, env)) return json({ error: 'Not found' }, { status: 404 });
      if (url.pathname === '/api/migration/import' && request.method === 'POST') return importRows(request, env);
      if (url.pathname === '/api/migration/status' && request.method === 'GET') return migrationStatus(env);
      if (url.pathname.startsWith('/api/migration/media/') && request.method === 'PUT') {
        const key = decodeURIComponent(url.pathname.slice('/api/migration/media/'.length));
        if (!key || key.includes('..')) return json({ error: 'Invalid media key' }, { status: 400 });
        const bytes = await request.arrayBuffer();
        await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' } });
        return json({ key, bytes: bytes.byteLength });
      }
      if (url.pathname.startsWith('/api/migration/test-user/') && request.method === 'DELETE') {
        const id = Number(url.pathname.split('/').pop());
        if (!Number.isInteger(id) || id < 900000) return json({ error: 'Invalid test user' }, { status: 400 });
        await env.DB.batch([
          env.DB.prepare('DELETE FROM household_members WHERE user_id = ?').bind(id),
          env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
        ]);
        return json({ deleted: id });
      }
      return json({ error: 'Not found' }, { status: 404 });
    }

    if (url.pathname === '/api/maintenance/backup-runner' && request.method === 'POST') {
      if (!secretAuthorized(request, env.BACKUP_TOKEN, 'x-backup-token')) return json({ error: 'Not found' }, { status: 404 });
      try { return json(await createBackup(env, { force: true })); }
      catch (error) {
        console.error('Postcards backup failed', error);
        return json({ error: 'Backup failed' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/photos/') && request.method === 'GET') {
      const key = decodeURIComponent(url.pathname.slice('/photos/'.length));
      if (!key || key.includes('..') || key.startsWith(backupPrefix)) return new Response('Not found', { status: 404 });
      const object = await env.MEDIA.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=86400');
      return new Response(object.body, { headers });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await parseJson(request);
        const identifier = normalizeEmail(body?.email || body?.username);
        if (!identifier || !body?.password) return json({ error: 'Email and password required' }, { status: 400 });
        if (!(await rateLimit(env, 'login', requestFingerprint(request, identifier), 10, 15 * 60))) {
          return json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }, { status: 429 });
        }
        const user = await env.DB.prepare(`
          SELECT id, username, email, email_verified_at, password_hash, display_name
          FROM users WHERE email = ? OR (email IS NULL AND lower(username) = ?) LIMIT 1
        `).bind(identifier, identifier).first();
        if (!user) {
          await hashPassword(body.password);
          return json({ error: 'Invalid email or password' }, { status: 401 });
        }
        if (!(await verifyPassword(body.password, user.password_hash))) return json({ error: 'Invalid email or password' }, { status: 401 });
        if (!String(user.password_hash).startsWith('pbkdf2_sha256$')) {
          try {
            const upgradedHash = await hashPassword(body.password);
            await env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(upgradedHash, user.id).run();
          } catch (error) {
            console.error('Legacy password upgrade deferred', error);
          }
        }
        await env.DB.prepare("DELETE FROM auth_rate_limits WHERE action = 'login' AND key = ?").bind(await sha256(`login:${requestFingerprint(request, identifier)}`)).run();
        const session = await createSession(env, user.id);
        const households = await userHouseholds(env, user.id);
        const publicUser = { id: user.id, username: user.username, email: user.email, email_verified_at: user.email_verified_at, display_name: user.display_name };
        return json({ user: publicUser, households, active_household_id: session.householdId, needs_email_upgrade: !user.email }, { headers: { 'set-cookie': sessionCookie(session.token) } });
      } catch (error) {
        console.error('Postcards login failed', error);
        return json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, { status: 500 });
      }
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const raw = cookieValue(request, 'postcards_session');
      if (raw) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(raw)).run();
      return json({ success: true }, { headers: { 'set-cookie': clearSessionCookie() } });
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') return json({ error: 'An invitation is required to create an account.' }, { status: 403 });

    if (url.pathname.startsWith('/api/auth/invitations/') && request.method === 'GET') {
      const rawToken = decodeURIComponent(url.pathname.slice('/api/auth/invitations/'.length));
      const invitation = await invitationByToken(env, rawToken);
      if (!invitation) return json({ error: 'This invitation is invalid or has expired.' }, { status: 404 });
      return json({ email: invitation.email, household_name: invitation.household_name, inviter_name: invitation.inviter_name, expires_at: invitation.expires_at, account_exists: Boolean(invitation.account_exists) });
    }

    if (url.pathname === '/api/auth/register-invite' && request.method === 'POST') {
      const body = await parseJson(request);
      const invitation = await invitationByToken(env, body?.token);
      if (!invitation) return json({ error: 'This invitation is invalid or has expired.' }, { status: 400 });
      if (invitation.account_exists) return json({ error: 'An account already uses this email. Sign in to accept the invitation.' }, { status: 409 });
      const problem = passwordProblem(body?.password);
      if (problem) return json({ error: problem }, { status: 400 });
      const displayName = String(body?.displayName || '').trim();
      if (displayName.length < 2 || displayName.length > 80) return json({ error: 'Enter your name.' }, { status: 400 });
      const passwordHash = await hashPassword(body.password);
      try {
        await env.DB.prepare(`
          INSERT INTO users (username, email, email_verified_at, password_hash, password_updated_at, display_name)
          VALUES (?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?)
        `).bind(invitation.email, invitation.email, passwordHash, displayName).run();
      } catch (error) {
        console.error('Invited registration failed', error);
        return json({ error: 'That email already has an account. Sign in instead.' }, { status: 409 });
      }
      const user = await env.DB.prepare('SELECT id, username, email, email_verified_at, display_name FROM users WHERE email = ?').bind(invitation.email).first();
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').bind(invitation.household_id, user.id, invitation.role),
        env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invitation.id),
      ]);
      const session = await createSession(env, user.id, invitation.household_id);
      return json({ user, households: await userHouseholds(env, user.id), active_household_id: invitation.household_id }, { status: 201, headers: { 'set-cookie': sessionCookie(session.token) } });
    }

    if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
      const body = await parseJson(request);
      const email = normalizeEmail(body?.email);
      const generic = { message: 'If an account uses that email, a reset link is on its way.' };
      if (!validEmail(email)) return json(generic);
      if (!(await rateLimit(env, 'forgot-password', requestFingerprint(request, email), 5, 60 * 60))) return json(generic);
      const user = await env.DB.prepare('SELECT id, email, display_name FROM users WHERE email = ? AND email_verified_at IS NOT NULL').bind(email).first();
      if (user) {
        const tokenId = crypto.randomUUID();
        const rawToken = randomToken();
        await env.DB.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(tokenId, user.id, await sha256(rawToken), new Date(Date.now() + 60 * 60 * 1000).toISOString()).run();
        ctx.waitUntil(sendPasswordResetEmail(env, request, user, rawToken, tokenId).catch(async error => {
          console.error('Password reset email failed', error);
          await env.DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(tokenId).run();
        }));
      }
      return json(generic);
    }

    if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
      const body = await parseJson(request);
      const problem = passwordProblem(body?.password);
      if (problem) return json({ error: problem }, { status: 400 });
      const reset = await env.DB.prepare(`
        SELECT pr.id, pr.user_id, u.email, u.display_name
        FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id
        WHERE pr.token_hash = ? AND pr.used_at IS NULL AND datetime(pr.expires_at) > CURRENT_TIMESTAMP LIMIT 1
      `).bind(await sha256(body?.token || '')).first();
      if (!reset) return json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(await hashPassword(body.password), reset.user_id),
        env.DB.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(reset.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(reset.user_id),
      ]);
      try {
        await sendEmail(env, { to: reset.email, subject: 'Your Postcards of Us password was changed', text: 'Your Postcards of Us password was changed. If this was not you, reply to this email immediately.', html: '<p>Your Postcards of Us password was changed.</p><p>If this was not you, reply to this email immediately.</p>', idempotencyKey: `postcards-password-changed-${reset.id}` });
      } catch (error) { console.error('Password change confirmation failed', error); }
      return json({ success: true, message: 'Password updated. Sign in with your new password.' }, { headers: { 'set-cookie': clearSessionCookie() } });
    }

    if (url.pathname === '/api/auth/verify-email' && request.method === 'POST') {
      const body = await parseJson(request);
      const verification = await env.DB.prepare(`
        SELECT id, user_id, email FROM email_verification_tokens
        WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP LIMIT 1
      `).bind(await sha256(body?.token || '')).first();
      if (!verification) return json({ error: 'This confirmation link is invalid or has expired.' }, { status: 400 });
      const conflict = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(verification.email, verification.user_id).first();
      if (conflict) return json({ error: 'That email is already connected to another account.' }, { status: 409 });
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET email = ?, username = ?, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').bind(verification.email, verification.email, verification.user_id),
        env.DB.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(verification.id),
      ]);
      return json({ success: true, message: 'Email confirmed. You can now sign in with it.' });
    }

    if (url.pathname.startsWith('/api/shared/journeys/') && request.method === 'GET') {
      const token = decodeURIComponent(url.pathname.slice('/api/shared/journeys/'.length));
      const result = await journeys(env, null, token);
      if (!result.length) return json({ error: 'This private journey link is no longer available.' }, { status: 404 });
      const { share_token: ignoredToken, share_expires_at: ignoredExpiry, household_id: ignoredHousehold, ...publicJourney } = result[0];
      return json(publicJourney);
    }

    if (url.pathname.startsWith('/api/')) {
      const user = await authenticate(request, env);
      if (!user) return json({ error: 'Invalid or expired session' }, { status: 401 });

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return json({
          user: { id: user.id, username: user.username, email: user.email, email_verified_at: user.email_verified_at, display_name: user.display_name },
          households: await userHouseholds(env, user.id),
          active_household_id: user.household_id,
          needs_email_upgrade: !user.email,
        });
      }

      if (url.pathname === '/api/account/email/start' && request.method === 'POST') {
        const body = await parseJson(request);
        const email = normalizeEmail(body?.email);
        if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, { status: 400 });
        if (!(await rateLimit(env, 'verify-email', requestFingerprint(request, email), 5, 60 * 60))) return json({ error: 'Too many confirmation requests. Please try again later.' }, { status: 429 });
        const conflict = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(email, user.id).first();
        if (conflict) return json({ error: 'That email is already connected to another account.' }, { status: 409 });
        const tokenId = crypto.randomUUID();
        const rawToken = randomToken();
        await env.DB.prepare('INSERT INTO email_verification_tokens (id, user_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)').bind(tokenId, user.id, email, await sha256(rawToken), new Date(Date.now() + 60 * 60 * 1000).toISOString()).run();
        try { await sendVerificationEmail(env, request, user, email, rawToken, tokenId); }
        catch (error) {
          await env.DB.prepare('DELETE FROM email_verification_tokens WHERE id = ?').bind(tokenId).run();
          return json({ error: 'Confirmation email could not be sent. Please try again.' }, { status: 503 });
        }
        return json({ message: `We sent a confirmation link to ${email}.` });
      }

      if (url.pathname === '/api/account/password' && request.method === 'POST') {
        const body = await parseJson(request);
        const problem = passwordProblem(body?.newPassword);
        if (problem) return json({ error: problem }, { status: 400 });
        if (!(await rateLimit(env, 'change-password', requestFingerprint(request, String(user.id)), 8, 30 * 60))) return json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
        const account = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
        if (!account || !(await verifyPassword(body?.currentPassword || '', account.password_hash))) return json({ error: 'Your current password is incorrect.' }, { status: 401 });
        const newHash = await hashPassword(body.newPassword);
        const statements = [env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, user.id)];
        if (user.session_token_hash) statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, user.session_token_hash));
        else statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id));
        await env.DB.batch(statements);
        if (user.session_token_hash) return json({ success: true, message: 'Password updated. Other sessions were signed out.' });
        const session = await createSession(env, user.id, user.household_id);
        return json({ success: true, message: 'Password updated. Other sessions were signed out.' }, { headers: { 'set-cookie': sessionCookie(session.token) } });
      }

      if (url.pathname === '/api/households' && request.method === 'GET') {
        return json({ households: await userHouseholds(env, user.id), active_household_id: user.household_id });
      }

      if (url.pathname === '/api/households' && request.method === 'POST') {
        const body = await parseJson(request);
        const name = String(body?.name || '').trim();
        if (name.length < 2 || name.length > 80) return json({ error: 'Enter a site name between 2 and 80 characters.' }, { status: 400 });
        const baseSlug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'memories';
        const slug = `${baseSlug}-${randomToken(5).toLowerCase()}`;
        const created = await env.DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind(slug, name).run();
        const householdId = Number(created.meta.last_row_id);
        await env.DB.prepare("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')").bind(householdId, user.id).run();
        if (user.session_token_hash) {
          await env.DB.prepare('UPDATE sessions SET household_id = ?, last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(householdId, user.session_token_hash).run();
          return json({ household: { id: householdId, slug, name, role: 'owner', member_count: 1 }, households: await userHouseholds(env, user.id), active_household_id: householdId }, { status: 201 });
        }
        const session = await createSession(env, user.id, householdId);
        return json({ household: { id: householdId, slug, name, role: 'owner', member_count: 1 }, households: await userHouseholds(env, user.id), active_household_id: householdId }, { status: 201, headers: { 'set-cookie': sessionCookie(session.token) } });
      }

      if (url.pathname === '/api/households/switch' && request.method === 'POST') {
        const body = await parseJson(request);
        const householdId = Number(body?.householdId);
        const membership = await env.DB.prepare('SELECT role FROM household_members WHERE user_id = ? AND household_id = ?').bind(user.id, householdId).first();
        if (!membership) return json({ error: 'You do not have access to that memory site.' }, { status: 403 });
        if (user.session_token_hash) {
          await env.DB.prepare('UPDATE sessions SET household_id = ?, last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(householdId, user.session_token_hash).run();
          return json({ success: true, active_household_id: householdId });
        }
        const session = await createSession(env, user.id, householdId);
        return json({ success: true, active_household_id: householdId }, { headers: { 'set-cookie': sessionCookie(session.token) } });
      }

      if (url.pathname === '/api/households/current/members' && request.method === 'GET') {
        const [members, pending] = await Promise.all([
          env.DB.prepare(`
            SELECT u.id, u.email, u.display_name, hm.role, hm.created_at
            FROM household_members hm JOIN users u ON u.id = hm.user_id
            WHERE hm.household_id = ? ORDER BY hm.created_at, u.id
          `).bind(user.household_id).all(),
          env.DB.prepare(`
            SELECT id, email, role, expires_at, created_at
            FROM invitations WHERE household_id = ? AND accepted_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
          `).bind(user.household_id).all(),
        ]);
        return json({ members: members.results || [], invitations: pending.results || [], role: user.role });
      }

      if (url.pathname === '/api/households/invitations' && request.method === 'POST') {
        if (!['owner', 'admin'].includes(user.role)) return json({ error: 'Only site owners can invite people.' }, { status: 403 });
        const body = await parseJson(request);
        const email = normalizeEmail(body?.email);
        if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, { status: 400 });
        if (!(await rateLimit(env, 'invite', `${user.id}:${user.household_id}`, 20, 60 * 60))) return json({ error: 'Too many invitations were sent. Please try again later.' }, { status: 429 });
        const existingMember = await env.DB.prepare(`
          SELECT 1 FROM household_members hm JOIN users u ON u.id = hm.user_id
          WHERE hm.household_id = ? AND u.email = ? LIMIT 1
        `).bind(user.household_id, email).first();
        if (existingMember) return json({ error: 'That person already belongs to this memory site.' }, { status: 409 });
        await env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE household_id = ? AND email = ? AND accepted_at IS NULL').bind(user.household_id, email).run();
        const invitationId = crypto.randomUUID();
        const rawToken = randomToken();
        const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
        await env.DB.prepare(`
          INSERT INTO invitations (id, household_id, email, token_hash, role, invited_by, expires_at)
          VALUES (?, ?, ?, ?, 'member', ?, ?)
        `).bind(invitationId, user.household_id, email, await sha256(rawToken), user.id, expiresAt).run();
        const invitation = { id: invitationId, email, household_name: user.household_name, inviter_name: user.display_name || user.email || user.username };
        try { await sendInvitationEmail(env, request, invitation, rawToken); }
        catch (error) {
          await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();
          return json({ error: 'The invitation email could not be sent. Please try again.' }, { status: 503 });
        }
        return json({ invitation: { id: invitationId, email, role: 'member', expires_at: expiresAt }, message: `Invitation sent to ${email}.` }, { status: 201 });
      }

      if (url.pathname === '/api/households/invitations/accept' && request.method === 'POST') {
        const body = await parseJson(request);
        const invitation = await invitationByToken(env, body?.token);
        if (!invitation) return json({ error: 'This invitation is invalid or has expired.' }, { status: 400 });
        if (!user.email || user.email !== invitation.email) return json({ error: 'Sign in with the email address that received this invitation.' }, { status: 403 });
        await env.DB.batch([
          env.DB.prepare('INSERT OR IGNORE INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').bind(invitation.household_id, user.id, invitation.role),
          env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invitation.id),
        ]);
        if (user.session_token_hash) await env.DB.prepare('UPDATE sessions SET household_id = ? WHERE token_hash = ?').bind(invitation.household_id, user.session_token_hash).run();
        return json({ success: true, active_household_id: invitation.household_id, households: await userHouseholds(env, user.id) });
      }

      if (url.pathname === '/api/trips' && request.method === 'GET') {
        const conditions = [];
        const values = [];
        if (url.searchParams.get('year')) { conditions.push("substr(t.start_date, 1, 4) = ?"); values.push(url.searchParams.get('year')); }
        if (url.searchParams.get('tripType')) { conditions.push('t.trip_type = ?'); values.push(url.searchParams.get('tripType')); }
        if (url.searchParams.get('travelerId')) { conditions.push('EXISTS (SELECT 1 FROM trip_travelers filter_tt WHERE filter_tt.trip_id = t.id AND filter_tt.traveler_id = ?)'); values.push(Number(url.searchParams.get('travelerId'))); }
        return json(await decorateTrips(env, user.household_id, conditions.length ? `AND ${conditions.join(' AND ')}` : '', values));
      }
      if (url.pathname === '/api/trips' && request.method === 'POST') {
        const parsed = tripInput(await parseJson(request));
        if (parsed.error) return json({ error: parsed.error }, { status: 400 });
        const input = parsed.value;
        const created = await env.DB.prepare(`
          INSERT INTO trips (household_id, location_name, city, latitude, longitude, country, state, start_date, end_date, date_label, date_precision, trip_type, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(user.household_id, input.locationName, input.city, input.latitude, input.longitude, input.country, input.state, input.startDate, input.endDate, input.dateLabel, input.datePrecision, input.tripType, input.notes, user.id).run();
        const tripId = Number(created.meta.last_row_id);
        const travelerIds = await householdTravelerIds(env, user.household_id, input.travelerIds);
        if (travelerIds.length) await env.DB.batch(travelerIds.map(travelerId => env.DB.prepare('INSERT OR IGNORE INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').bind(tripId, travelerId)));
        const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [tripId]);
        return json(trips[0], { status: 201 });
      }

      const tripMatch = url.pathname.match(/^\/api\/trips\/(\d+)$/);
      if (tripMatch && request.method === 'GET') {
        const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [Number(tripMatch[1])]);
        return trips.length ? json(trips[0]) : json({ error: 'Trip not found' }, { status: 404 });
      }
      if (tripMatch && request.method === 'DELETE') {
        const tripId = Number(tripMatch[1]);
        const trip = await env.DB.prepare('SELECT id, location_name FROM trips WHERE id = ? AND household_id = ? LIMIT 1').bind(tripId, user.household_id).first();
        if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

        const photoRows = (await env.DB.prepare('SELECT id, r2_key, thumbnail_r2_key FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id).all()).results || [];
        let mediaKeys;
        try {
          await createBackup(env, { force: true });
          mediaKeys = await tripMediaKeys(env, tripId, photoRows);
        } catch (error) {
          console.error('Pre-delete Postcards backup failed', error);
          return json({ error: 'The safety backup could not be completed, so this memory was not deleted. Please try again.' }, { status: 503 });
        }

        const statements = [];
        if (photoRows.length) {
          const photoIds = photoRows.map(photo => photo.id);
          statements.push(env.DB.prepare(`UPDATE journeys SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE household_id = ? AND cover_photo_id IN (${photoIds.map(() => '?').join(',')})`).bind(user.household_id, ...photoIds));
        }
        statements.push(
          env.DB.prepare('DELETE FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id),
          env.DB.prepare('DELETE FROM trip_travelers WHERE trip_id = ?').bind(tripId),
          env.DB.prepare('DELETE FROM trips WHERE id = ? AND household_id = ?').bind(tripId, user.household_id),
        );
        await env.DB.batch(statements);

        let mediaCleanupPending = false;
        try {
          await deleteMediaKeys(env, mediaKeys);
        } catch (error) {
          mediaCleanupPending = true;
          console.error(`Postcards media cleanup failed for trip ${tripId}`, error);
          ctx.waitUntil(deleteMediaKeys(env, mediaKeys).catch(retryError => console.error(`Postcards media cleanup retry failed for trip ${tripId}`, retryError)));
        }
        ctx.waitUntil(createBackup(env, { force: true }).catch(error => console.error('Post-delete Postcards backup failed', error)));

        return json({ success: true, deleted: tripId, location_name: trip.location_name, deletedPhotoObjects: mediaKeys.length, mediaCleanupPending });
      }
      if (tripMatch && request.method === 'PUT') {
        const tripId = Number(tripMatch[1]);
        const existing = await env.DB.prepare('SELECT id FROM trips WHERE id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        if (!existing) return json({ error: 'Trip not found' }, { status: 404 });
        const parsed = tripInput(await parseJson(request));
        if (parsed.error) return json({ error: parsed.error }, { status: 400 });
        const input = parsed.value;
        const travelerIds = await householdTravelerIds(env, user.household_id, input.travelerIds);
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE trips SET location_name = ?, city = ?, latitude = ?, longitude = ?, country = ?, state = ?, start_date = ?, end_date = ?, date_label = ?, date_precision = ?, trip_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND household_id = ?
          `).bind(input.locationName, input.city, input.latitude, input.longitude, input.country, input.state, input.startDate, input.endDate, input.dateLabel, input.datePrecision, input.tripType, input.notes, tripId, user.household_id),
          env.DB.prepare('DELETE FROM trip_travelers WHERE trip_id = ?').bind(tripId),
          ...travelerIds.map(travelerId => env.DB.prepare('INSERT OR IGNORE INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').bind(tripId, travelerId)),
        ]);
        const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [tripId]);
        return json(trips[0]);
      }

      if (url.pathname === '/api/travelers' && request.method === 'GET') {
        const includeInactive = url.searchParams.get('includeInactive') === 'true';
        const rows = (await env.DB.prepare(`SELECT * FROM travelers WHERE household_id = ? ${includeInactive ? '' : 'AND is_active = 1'} ORDER BY is_active DESC, created_at, id`).bind(user.household_id).all()).results || [];
        return json(rows.map(row => ({ ...row, is_active: Boolean(row.is_active) })));
      }

      if (url.pathname === '/api/journeys' && request.method === 'GET') return json(await journeys(env, user.household_id));

      const shareMatch = url.pathname.match(/^\/api\/journeys\/(\d+)\/share$/);
      if (shareMatch && request.method === 'POST') {
        const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const result = await env.DB.prepare('UPDATE journeys SET share_token = ?, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?').bind(token, Number(shareMatch[1]), user.household_id).run();
        return result.meta.changes ? json({ id: Number(shareMatch[1]), share_token: token, share_expires_at: null }) : json({ error: 'Journey not found' }, { status: 404 });
      }
      if (shareMatch && request.method === 'DELETE') {
        const result = await env.DB.prepare('UPDATE journeys SET share_token = NULL, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?').bind(Number(shareMatch[1]), user.household_id).run();
        return result.meta.changes ? json({ success: true, id: Number(shareMatch[1]) }) : json({ error: 'Journey not found' }, { status: 404 });
      }

      if (url.pathname === '/api/analytics' && request.method === 'GET') {
        const tripRows = await decorateTrips(env, user.household_id);
        const travelerRows = (await env.DB.prepare('SELECT * FROM travelers WHERE household_id = ?').bind(user.household_id).all()).results || [];
        return json(analytics(tripRows, travelerRows));
      }

      if (url.pathname === '/api/maintenance/backup-status' && request.method === 'GET') {
        const latest = await readLatestBackup(env);
        const due = !latest?.lastSuccessfulBackupAt || Date.now() - Date.parse(latest.lastSuccessfulBackupAt) > 24 * 60 * 60 * 1000;
        if (due) ctx.waitUntil(createBackup(env).catch(error => console.error('Automatic Postcards backup failed', error)));
        return json(backupStatus(latest));
      }

      if (url.pathname === '/api/maintenance/backup-now' && request.method === 'POST') {
        try { return json(backupStatus(await createBackup(env, { force: true }))); }
        catch (error) {
          console.error('Manual Postcards backup failed', error);
          return json({ error: 'The backup could not be completed. Please try again.' }, { status: 500 });
        }
      }

      const photoMatch = url.pathname.match(/^\/api\/photos\/(\d+)$/);
      if (photoMatch && request.method === 'POST') {
        const tripId = Number(photoMatch[1]);
        const trip = await env.DB.prepare('SELECT id FROM trips WHERE id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

        let formData;
        try { formData = await request.formData(); }
        catch { return json({ error: 'The selected photos could not be read.' }, { status: 400 }); }
        const files = formData.getAll('photos').filter(file => file && typeof file.arrayBuffer === 'function');
        if (!files.length) return json({ error: 'No photos selected' }, { status: 400 });
        if (files.length > 50) return json({ error: 'Upload no more than 50 photos at once.' }, { status: 400 });
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
        if (files.some(file => !allowedTypes.has(photoMimeType(file)) || file.size > 20 * 1024 * 1024)) return json({ error: 'Photos must be JPEG, PNG, GIF, WebP, or HEIC files no larger than 20 MB each.' }, { status: 400 });

        const metadata = uploadMetadata(formData);
        const nextOrder = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
        const uploads = files.map((file, index) => ({
          file,
          mimeType: photoMimeType(file),
          metadata: metadata[index] || {},
          key: `${tripId}/original/${crypto.randomUUID()}.${extensionByType[photoMimeType(file)]}`,
          sortOrder: Number(nextOrder?.next_sort_order || 0) + index,
          isCover: Number(nextOrder?.next_sort_order || 0) === 0 && index === 0,
        }));

        try {
          for (const upload of uploads) {
            await env.MEDIA.put(upload.key, await upload.file.arrayBuffer(), { httpMetadata: { contentType: upload.mimeType } });
          }
          const results = await env.DB.batch(uploads.map(upload => env.DB.prepare(`
            INSERT INTO photos (household_id, trip_id, r2_key, thumbnail_r2_key, original_filename, file_size, mime_type, date_taken, latitude, longitude, sort_order, is_cover)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(user.household_id, tripId, upload.key, upload.key, String(upload.file.name || 'photo').slice(0, 255), upload.file.size, upload.mimeType, upload.metadata.dateTaken || null, upload.metadata.latitude ?? null, upload.metadata.longitude ?? null, upload.sortOrder, upload.isCover ? 1 : 0)));
          const rows = uploads.map((upload, index) => ({
            id: Number(results[index].meta.last_row_id),
            household_id: user.household_id,
            trip_id: tripId,
            r2_key: upload.key,
            thumbnail_r2_key: upload.key,
            original_filename: String(upload.file.name || 'photo').slice(0, 255),
            file_size: upload.file.size,
            mime_type: upload.mimeType,
            date_taken: upload.metadata.dateTaken || null,
            latitude: upload.metadata.latitude ?? null,
            longitude: upload.metadata.longitude ?? null,
            caption: null,
            sort_order: upload.sortOrder,
            is_cover: upload.isCover,
            rotation: 0,
          }));
          ctx.waitUntil(createBackup(env, { force: true }).catch(error => console.error('Post-upload Postcards backup failed', error)));
          return json({ count: rows.length, photos: rows.map(photoJson) }, { status: 201 });
        } catch (error) {
          await deleteMediaKeys(env, uploads.map(upload => upload.key)).catch(() => null);
          console.error('Postcards photo upload failed', error);
          return json({ error: 'The photos could not be saved. Please try again.' }, { status: 500 });
        }
      }
      if (photoMatch && request.method === 'GET') {
        const rows = (await env.DB.prepare('SELECT p.* FROM photos p JOIN trips t ON t.id = p.trip_id WHERE p.trip_id = ? AND p.household_id = ? AND t.household_id = ? ORDER BY p.is_cover DESC, p.sort_order, p.date_taken, p.uploaded_at, p.id').bind(Number(photoMatch[1]), user.household_id, user.household_id).all()).results || [];
        return json(rows.map(photoJson));
      }

      return json({ error: 'This editing action is not available during the migration cutover.' }, { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;

    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  },
};
