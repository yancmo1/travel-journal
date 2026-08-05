import bcrypt from 'bcryptjs';
import { BACKUP_PREFIX, distinctMediaKeys, isSafeMediaKey, uploadMediaKey } from './lib/media.js';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const encoder = new TextEncoder();
const passwordIterations = 100000;
const placesCache = new Map();
const locationCache = new Map();
const GITHUB_LABEL = 'Bug Report';

async function recordAudit(env, { userId = null, householdId = null, action, resourceType = null, resourceId = null, metadata = null }) {
  if (!action || !env?.DB) return;
  const safeMetadata = metadata == null ? null : JSON.stringify(metadata).slice(0, 4000);
  try {
    await env.DB.prepare(`
      INSERT INTO audit_events (id, user_id, household_id, action, resource_type, resource_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), userId, householdId, String(action).slice(0, 120), resourceType ? String(resourceType).slice(0, 80) : null, resourceId == null ? null : String(resourceId).slice(0, 120), safeMetadata).run();
  } catch (error) {
    console.error('Postcards audit write failed', error);
  }
}

async function recordOperationalEvent(env, { action, requestId = null, route = null, status = null, userId = null, householdId = null, metadata = null }) {
  return recordAudit(env, {
    action: `ops.${action}`,
    userId,
    householdId,
    resourceType: 'operations',
    resourceId: requestId,
    metadata: { route, status, ...metadata },
  });
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

export function featureEnabled(env, name, fallback = true) {
  const raw = env?.[name];
  if (raw == null || raw === '') return fallback;
  return !['0', 'false', 'off', 'disabled', 'no'].includes(String(raw).trim().toLowerCase());
}

export function uploadQuotaExceeded({
  currentStorageBytes = 0,
  incomingBytes = 0,
  maxStorageBytes = 0,
  dailyUploadCount = 0,
  dailyUploadBytes = 0,
  newUploadCount = 0,
  maxUploadsPerDay = 0,
  maxUploadBytesPerDay = 0,
}) {
  return Boolean(
    (maxStorageBytes && currentStorageBytes + incomingBytes > maxStorageBytes)
    || (maxUploadsPerDay && dailyUploadCount + newUploadCount > maxUploadsPerDay)
    || (maxUploadBytesPerDay && dailyUploadBytes + incomingBytes > maxUploadBytesPerDay),
  );
}

function featureUnavailable(name) {
  return json({ error: 'This feature is temporarily unavailable.' }, {
    status: 503,
    headers: { 'retry-after': '300', 'x-feature': name },
  });
}

function base64url(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hexDigest(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function decodeBase64url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function encodePageCursor(value) {
  return base64url(encoder.encode(JSON.stringify(value)));
}

export function decodePageCursor(value) {
  if (!value || String(value).length > 512) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(decodeBase64url(String(value))));
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function backupObjectReusable(previous, object) {
  return Boolean(
    previous?.backupKey
    && previous.etag
    && object?.etag
    && previous.etag === object.etag
    && Number(previous.size || 0) === Number(object.size || 0),
  );
}

function cursorPage(url, defaultLimit = 50) {
  const requested = url.searchParams.has('limit') || url.searchParams.has('cursor') || url.searchParams.get('paginate') === 'true';
  if (!requested) return null;
  const rawLimit = Number(url.searchParams.get('limit') || defaultLimit);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : defaultLimit;
  const rawCursor = url.searchParams.get('cursor');
  if (rawCursor && !decodePageCursor(rawCursor)) return { error: 'Invalid page cursor' };
  return { limit, cursor: rawCursor ? decodePageCursor(rawCursor) : null };
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
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

function normalizePlaceQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function googleAddressValue(components, type) {
  return components?.find(component => component.types?.includes(type))?.longText || '';
}

function googlePlaceResult(place) {
  const components = place.addressComponents || [];
  const address = {
    city: googleAddressValue(components, 'locality') || googleAddressValue(components, 'postal_town'),
    state: googleAddressValue(components, 'administrative_area_level_1'),
    country: googleAddressValue(components, 'country'),
    attraction: place.displayName?.text || '',
  };
  return {
    display_name: place.formattedAddress || place.displayName?.text || '',
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    type: place.types?.[0] || 'place',
    class: 'place',
    address,
  };
}

function providerCacheKey(provider, key) {
  return `${provider}:${key}`;
}

async function getPersistentCache(env, provider, key) {
  if (!env?.DB) return null;
  try {
    const row = await env.DB.prepare(`
      SELECT value FROM provider_cache
      WHERE cache_key = ? AND provider = ? AND datetime(expires_at) > CURRENT_TIMESTAMP
      LIMIT 1
    `).bind(providerCacheKey(provider, key), provider).first();
    if (!row?.value) return null;
    return JSON.parse(row.value);
  } catch (error) {
    console.error('Postcards provider cache read failed', String(error?.message || error));
    return null;
  }
}

async function setPersistentCache(env, provider, key, value, ttlMs, maxEntries) {
  if (!env?.DB || value == null) return;
  const serialized = JSON.stringify(value);
  if (serialized.length > 100000) return;
  const cacheKey = providerCacheKey(provider, key);
  const expiresAt = new Date(Date.now() + Math.max(Number(ttlMs) || 0, 0)).toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO provider_cache (cache_key, provider, value, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value,
        expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP
    `).bind(cacheKey, provider, serialized, expiresAt).run();
    const bounded = Math.min(Math.max(Number(maxEntries) || 1, 1), 10000);
    await env.DB.prepare(`
      DELETE FROM provider_cache
      WHERE provider = ?
        AND (datetime(expires_at) <= CURRENT_TIMESTAMP OR cache_key NOT IN (
          SELECT cache_key FROM provider_cache
          WHERE provider = ? ORDER BY updated_at DESC LIMIT ?
        ))
    `).bind(provider, provider, bounded).run();
  } catch (error) {
    console.error('Postcards provider cache write failed', String(error?.message || error));
  }
}

async function getPlaceCache(env, query, ttlMs) {
  const cached = placesCache.get(query);
  if (cached?.expiresAt > Date.now()) return cached.results;
  if (cached) placesCache.delete(query);
  const persistent = await getPersistentCache(env, 'google_places', query);
  if (persistent) {
    placesCache.set(query, { results: persistent, expiresAt: Date.now() + Math.max(ttlMs, 0) });
    return persistent;
  }
  return null;
}

async function setPlaceCache(env, query, results, ttlMs, maxEntries) {
  placesCache.set(query, { results, expiresAt: Date.now() + Math.max(ttlMs, 0) });
  while (placesCache.size > Math.max(maxEntries, 1)) placesCache.delete(placesCache.keys().next().value);
  await setPersistentCache(env, 'google_places', query, results, ttlMs, maxEntries);
}

function locationCacheKey(latitude, longitude) {
  return `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
}

async function reverseGeocodeLocation(env, latitude, longitude) {
  const key = locationCacheKey(latitude, longitude);
  const cached = locationCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.value;
  const persistent = await getPersistentCache(env, 'nominatim_reverse', key);
  if (persistent) {
    locationCache.set(key, { value: persistent, expiresAt: Date.now() + 60 * 60 * 1000 });
    return persistent;
  }
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  const response = await fetch(url, {
    headers: {
      'accept-language': 'en',
      'user-agent': env.LOCATION_USER_AGENT || 'postcardsofus.com/1.0',
    },
  });
  if (!response.ok) throw new Error(`Location lookup failed with ${response.status}`);
  const result = await response.json();
  const address = result.address || {};
  const value = {
    displayName: result.display_name || null,
    city: address.city || address.town || address.village || address.municipality || null,
    state: address.state || address.region || null,
    country: address.country || null,
  };
  locationCache.set(key, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
  await setPersistentCache(env, 'nominatim_reverse', key, value, 60 * 60 * 1000, Number(env.LOCATION_CACHE_MAX_ENTRIES || 5000));
  return value;
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

async function sha256Bytes(value) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', value)));
}

function requestIdempotencyValue(request) {
  const value = request.headers.get('idempotency-key');
  if (!value) return null;
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(value) ? value : { error: 'The idempotency key is invalid.' };
}

async function claimIdempotency(env, request, user, operation, body) {
  const requested = requestIdempotencyValue(request);
  if (!requested) return null;
  if (requested.error) return { response: json({ error: requested.error }, { status: 400 }) };
  const scopeKey = `v1:${operation}:${user.id}:${user.household_id ?? 0}:${requested}`;
  const requestHash = await sha256(JSON.stringify(body ?? null));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO idempotency_keys (scope_key, request_hash, status, expires_at)
    VALUES (?, ?, 'pending', ?)
  `).bind(scopeKey, requestHash, expiresAt).run();
  if (Number(inserted.meta?.changes || 0) > 0) return { scopeKey, requestHash };

  const existing = await env.DB.prepare('SELECT request_hash, status, response_status, response_body, expires_at FROM idempotency_keys WHERE scope_key = ? LIMIT 1').bind(scopeKey).first();
  if (!existing || Date.parse(existing.expires_at) <= Date.now()) {
    await env.DB.prepare('DELETE FROM idempotency_keys WHERE scope_key = ?').bind(scopeKey).run();
    const retry = await env.DB.prepare(`
      INSERT OR IGNORE INTO idempotency_keys (scope_key, request_hash, status, expires_at)
      VALUES (?, ?, 'pending', ?)
    `).bind(scopeKey, requestHash, expiresAt).run();
    return Number(retry.meta?.changes || 0) > 0
      ? { scopeKey, requestHash }
      : { response: json({ error: 'This request is already being processed. Please retry shortly.' }, { status: 409, headers: { 'retry-after': '5' } }) };
  }
  if (existing.request_hash !== requestHash) return { response: json({ error: 'This idempotency key was already used for different request data.' }, { status: 409 }) };
  if (existing.status === 'complete' && existing.response_body) {
    try {
      const replayBody = JSON.parse(existing.response_body);
      return {
        response: json(replayBody, { status: Number(existing.response_status || 200), headers: { 'idempotent-replay': 'true' } }),
        replayBody,
        replayStatus: Number(existing.response_status || 200),
      };
    } catch {
      return { response: json({ error: 'The previous idempotent response could not be replayed.' }, { status: 500 }) };
    }
  }
  return { response: json({ error: 'This request is already being processed. Please retry shortly.' }, { status: 409, headers: { 'retry-after': '5' } }) };
}

async function completeIdempotency(env, claim, responseBody, responseStatus) {
  if (!claim?.scopeKey) return;
  await env.DB.prepare(`
    UPDATE idempotency_keys
    SET status = 'complete', response_status = ?, response_body = ?, updated_at = CURRENT_TIMESTAMP
    WHERE scope_key = ? AND request_hash = ?
  `).bind(responseStatus, JSON.stringify(responseBody), claim.scopeKey, claim.requestHash).run();
}

async function releaseIdempotency(env, claim) {
  if (!claim?.scopeKey) return;
  await env.DB.prepare('DELETE FROM idempotency_keys WHERE scope_key = ? AND request_hash = ?').bind(claim.scopeKey, claim.requestHash).run();
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

async function rotateCurrentSession(env, user, householdId, { revokeOthers = false } = {}) {
  const session = await createSession(env, user.id, householdId);
  if (revokeOthers) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, session.tokenHash).run();
  } else if (user.session_token_hash) {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash = ?').bind(user.id, user.session_token_hash).run();
  }
  return session;
}

async function userHouseholds(env, userId) {
  return (await env.DB.prepare(`
    SELECT h.id, h.slug, h.name, hm.role,
      (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count
    FROM household_members hm JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = ? ORDER BY h.created_at, h.id
  `).bind(userId).all()).results || [];
}

const OPERATIONS_ADMIN_EMAIL = 'yancmo@gmail.com';

function isOperationsAdmin(user) {
  return String(user?.email || '').trim().toLowerCase() === OPERATIONS_ADMIN_EMAIL;
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    email_verified_at: user.email_verified_at,
    display_name: user.display_name,
    site_admin: isOperationsAdmin(user),
  };
}

function siteAdminRequired(user) {
  return isOperationsAdmin(user)
    ? null
    : json({ error: 'Site administrator access required.' }, { status: 403 });
}

export function emailConfiguration(env) {
  return {
    provider: 'resend',
    sender_configured: Boolean(env?.EMAIL_FROM),
    delivery_configured: Boolean(env?.EMAIL_FROM && env?.RESEND_API_KEY),
  };
}

async function authenticate(request, env) {
  const sessionToken = cookieValue(request, 'postcards_session');
  if (sessionToken) {
    const tokenHash = await sha256(sessionToken);
    const user = await env.DB.prepare(`
      SELECT u.id, u.email, u.email_verified_at, u.password_updated_at, u.display_name, u.site_admin,
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
      SELECT u.id, u.email, u.email_verified_at, u.password_updated_at, u.display_name, u.site_admin,
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
  if (!featureEnabled(env, 'ENABLE_MIGRATION_ENDPOINTS', false) || !env.MIGRATION_TOKEN) return false;
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

function parseAuditMetadata(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

function inlineFilename(value) {
  return String(value || 'screenshot').replace(/[\\"\r\n]/g, '_').slice(0, 160);
}

function githubRepository(env) {
  const value = String(env?.GITHUB_REPOSITORY || 'yancmo1/travel-journal').trim();
  const match = value.match(/^([^/]+)\/([^/]+)$/);
  return match ? { owner: match[1], name: match[2] } : null;
}

async function githubJson(env, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'postcards-of-us',
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function githubIssueBody(reportId, metadata) {
  return [
    'Submitted from the Postcards of Us Feedback inbox.',
    '',
    '## Details',
    metadata.details || 'No details provided.',
    '',
    '## Diagnostics',
    `- Report ID: \`${reportId}\``,
    `- Request reference: \`${metadata.requestId || 'Not available'}\``,
    `- Page: ${metadata.page || 'Not available'}`,
    `- URL: ${metadata.url || 'Not available'}`,
    `- App version: ${metadata.appVersion || 'Not available'}`,
    `- Browser: ${metadata.userAgent || 'Not available'}`,
    metadata.screenshot?.filename ? `- Screenshot: ${metadata.screenshot.filename} (available in the private Operations inbox)` : '- Screenshot: None attached',
  ].join('\n');
}

async function sendEmail(env, { to, subject, text, html, idempotencyKey, attachments = [] }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('Email delivery is not configured');
  let lastError = new Error('Email delivery failed');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [to],
          subject,
          text,
          html,
          ...(attachments.length ? { attachments } : {}),
        }),
      });
      if (!response.ok) {
        lastError = new Error(`Email delivery failed with status ${response.status}`);
        console.error('Email delivery attempt failed', { status: response.status, attempt });
      } else {
        return response.json();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Email delivery failed');
      console.error('Email delivery attempt failed', { attempt });
    }
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
  }
  throw lastError;
}

async function sendBugReportNotification(env, { reportId, title, details, context, user, screenshot = null }) {
  const recipient = String(env.BUG_REPORT_TO || '').trim();
  if (!recipient) return;
  const compactTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120);
  const requestId = String(context.requestId || '').slice(0, 120) || 'Not available';
  const page = String(context.page || '').slice(0, 200) || 'Not available';
  const url = String(context.url || '').slice(0, 500) || 'Not available';
  const appVersion = String(context.appVersion || '').slice(0, 40) || 'Not available';
  const userAgent = String(context.userAgent || '').slice(0, 500) || 'Not available';
  const text = [
    'A new Postcards of Us bug report was submitted.',
    '',
    `Title: ${compactTitle}`,
    `Details: ${details}`,
    '',
    `Request reference: ${requestId}`,
    `Page: ${page}`,
    `URL: ${url}`,
    `App version: ${appVersion}`,
    `Reported by: ${user.email || user.display_name || `user ${user.id}`}`,
    `Browser: ${userAgent}`,
    `Report ID: ${reportId}`,
  ].join('\n');
  const htmlDetails = escapeHtml(details).replace(/\n/g, '<br />');
  const html = `<h2>New Postcards of Us bug report</h2><p><strong>Title:</strong> ${escapeHtml(compactTitle)}</p><p><strong>Details:</strong><br />${htmlDetails}</p><hr /><p><strong>Request reference:</strong> ${escapeHtml(requestId)}<br /><strong>Page:</strong> ${escapeHtml(page)}<br /><strong>URL:</strong> ${escapeHtml(url)}<br /><strong>App version:</strong> ${escapeHtml(appVersion)}<br /><strong>Reported by:</strong> ${escapeHtml(user.email || user.display_name || `user ${user.id}`)}<br /><strong>Browser:</strong> ${escapeHtml(userAgent)}<br /><strong>Report ID:</strong> ${escapeHtml(reportId)}</p>`;
  const attachments = screenshot?.bytes
    ? [{ filename: screenshot.filename, content: base64(screenshot.bytes) }]
    : [];
  await sendEmail(env, {
    to: recipient,
    subject: `[Postcards of Us] Bug report: ${compactTitle}`,
    text,
    html,
    idempotencyKey: `bug-report-${reportId}`,
    attachments,
  });
}

async function rateLimit(env, action, identifier, limit, windowSeconds) {
  const key = await sha256(`${action}:${identifier}`);
  const now = Date.now();
  const startedAt = new Date(now).toISOString();
  const resetBefore = new Date(now - windowSeconds * 1000).toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO auth_rate_limits (key, action, attempts, window_started_at)
      VALUES (?, ?, 0, ?)
    `).bind(key, action, startedAt),
    env.DB.prepare(`
      UPDATE auth_rate_limits
      SET attempts = CASE WHEN window_started_at < ? THEN 1 ELSE MIN(attempts + 1, ?) END,
          window_started_at = CASE WHEN window_started_at < ? THEN ? ELSE window_started_at END,
          action = ?
      WHERE key = ?
      RETURNING attempts
    `).bind(resetBefore, limit + 1, resetBefore, startedAt, action, key),
  ]);
  const attempts = Number(results[1]?.results?.[0]?.attempts || limit + 1);
  return attempts <= limit;
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

async function sendVerificationEmail(env, request, user, rawToken, tokenId) {
  const link = `${new URL(request.url).origin}/?verify=${encodeURIComponent(rawToken)}`;
  return sendEmail(env, {
    to: user.email,
    subject: 'Verify your Postcards of Us email',
    text: `Verify your Postcards of Us email address: ${link}\n\nThis link expires in 24 hours. If you did not request it, you can ignore this email.`,
    html: `<p>Verify your Postcards of Us email address.</p><p><a href="${escapeHtml(link)}">Verify email address</a></p><p>This link expires in 24 hours. If you did not request it, you can ignore this email.</p>`,
    idempotencyKey: `postcards-verify-${tokenId}`,
  });
}

const backupPrefix = BACKUP_PREFIX;
// Durable content and operation state belong in the recovery snapshot. Session,
// password-token, verification-token, rate-limit, and upload-reservation rows
// are intentionally excluded because they are ephemeral security/runtime state
// and must not be resurrected during a restore.
const backupTables = [
  'users', 'households', 'household_members', 'invitations',
  'travelers', 'journeys', 'trips', 'trip_travelers', 'photos',
  'data_exports', 'data_deletions', 'jobs', 'audit_events',
  'provider_cache', 'idempotency_keys',
];

async function readLatestBackup(env) {
  const object = await env.MEDIA.get(`${backupPrefix}latest.json`);
  if (!object) return null;
  try { return JSON.parse(await object.text()); } catch { return null; }
}

async function readBackupMediaIndex(env, manifest) {
  if (!manifest?.mediaManifestKey) return new Map();
  const object = await env.MEDIA.get(manifest.mediaManifestKey);
  if (!object) return new Map();
  try {
    const body = JSON.parse(await object.text());
    return new Map((Array.isArray(body?.objects) ? body.objects : []).map(row => [row.key, row]));
  } catch {
    return new Map();
  }
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

export async function createBackup(env, { force = false } = {}) {
  const existing = await readLatestBackup(env);
  const existingAge = existing?.lastSuccessfulBackupAt ? Date.now() - Date.parse(existing.lastSuccessfulBackupAt) : Infinity;
  if (!force && existingAge < 23 * 60 * 60 * 1000) return existing;

  const startedAt = new Date().toISOString();
  const queryResults = await env.DB.batch(backupTables.map(table => env.DB.prepare(`SELECT * FROM ${table}`)));
  const tables = Object.fromEntries(backupTables.map((table, index) => [table, queryResults[index].results || []]));
  const sourceMedia = await listSourceMedia(env);
  const previousMedia = await readBackupMediaIndex(env, existing);
  const media = [];
  let copiedObjects = 0;
  let copiedBytes = 0;
  let photoStorageBytes = 0;

  for (const object of sourceMedia) {
    photoStorageBytes += Number(object.size || 0);
    const previous = previousMedia.get(object.key);
    const encodedKey = base64url(object.key);
    const candidateKey = `${backupPrefix}media/${encodedKey}/${cleanEtag(object.etag)}`;
    const backupKey = backupObjectReusable(previous, object) ? previous.backupKey : candidateKey;
    const archiveExists = await env.MEDIA.head(backupKey);
    if (!archiveExists) {
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

  const safeTimestamp = startedAt.replace(/[:.]/g, '-');
  const mediaManifestKey = `${backupPrefix}manifests/${safeTimestamp}.json`;
  const mediaManifestBytes = encoder.encode(JSON.stringify({
    format: 'postcards-cloudflare-media-manifest',
    version: 1,
    createdAt: startedAt,
    objects: media,
  }));
  const mediaManifestSha256 = hexDigest(await crypto.subtle.digest('SHA-256', mediaManifestBytes));
  await env.MEDIA.put(mediaManifestKey, mediaManifestBytes, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

  const snapshot = {
    format: 'postcards-cloudflare-backup',
    version: 2,
    createdAt: startedAt,
    database: { engine: 'Cloudflare D1', tables },
    media: { engine: 'Cloudflare R2', manifestKey: mediaManifestKey, manifestSha256: mediaManifestSha256, objects: media },
  };
  const snapshotBytes = encoder.encode(JSON.stringify(snapshot));
  const databaseSha256 = hexDigest(await crypto.subtle.digest('SHA-256', snapshotBytes));
  const databaseKey = `${backupPrefix}database/${safeTimestamp}.json`;
  await env.MEDIA.put(databaseKey, snapshotBytes, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

  const manifest = {
    configured: true,
    stale: false,
    lastSuccessfulBackupAt: startedAt,
    lastDatabaseDumpAt: startedAt,
    databaseDumpBytes: snapshotBytes.byteLength,
    databaseKey,
    databaseSha256,
    mediaManifestKey,
    mediaManifestSha256,
    databaseTableCounts: Object.fromEntries(backupTables.map(table => [table, tables[table].length])),
    sourcePhotoObjects: sourceMedia.length,
    photoStorageBytes,
    protectedPhotoObjects: media.length,
    protectedPhotoBytes: photoStorageBytes,
    copiedObjects,
    copiedBytes,
    recovery: { database: 'Cloudflare D1 Time Travel plus R2 export', photos: 'Incremental, versioned R2 archive copies referenced by media manifests' },
  };
  await env.MEDIA.put(`${backupPrefix}latest.json`, encoder.encode(JSON.stringify(manifest)), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return manifest;
}

async function tripMediaKeys(env, householdId, tripId, photoRows = []) {
  const keys = new Set();
  for (const photo of photoRows) {
    if (photo.r2_key && !photo.r2_key.startsWith(backupPrefix)) keys.add(photo.r2_key);
    if (photo.display_r2_key && !photo.display_r2_key.startsWith(backupPrefix)) keys.add(photo.display_r2_key);
    if (photo.thumbnail_r2_key && !photo.thumbnail_r2_key.startsWith(backupPrefix)) keys.add(photo.thumbnail_r2_key);
  }

  let cursor;
  for (const prefix of [`households/${householdId}/trips/${tripId}/`, `${tripId}/`]) {
    cursor = undefined;
    do {
      const page = await env.MEDIA.list({ prefix, cursor });
      for (const object of page.objects) {
        if (!object.key.startsWith(backupPrefix)) keys.add(object.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }

  return [...keys];
}

async function deleteMediaKeys(env, keys) {
  for (let index = 0; index < keys.length; index += 1000) {
    await env.MEDIA.delete(keys.slice(index, index + 1000));
  }
}

const exportPrefix = '_exports/households/';

function exportMediaKey(householdId, exportId, photoId, variant, extension = 'bin') {
  return `${exportPrefix}${householdId}/${exportId}/media/${photoId}/${variant}.${extension}`;
}

async function householdExportManifest(env, exportRow) {
  const household = await env.DB.prepare('SELECT id, slug, name, created_at, updated_at FROM households WHERE id = ? LIMIT 1').bind(exportRow.household_id).first();
  if (!household) throw new Error('Household no longer exists');
  const [members, invitations, travelers, journeysRows, trips, links, photos] = await Promise.all([
    env.DB.prepare(`SELECT hm.household_id, hm.user_id, hm.role, hm.created_at, u.email, u.display_name
      FROM household_members hm JOIN users u ON u.id = hm.user_id WHERE hm.household_id = ? ORDER BY hm.created_at, hm.user_id`).bind(exportRow.household_id).all(),
    env.DB.prepare(`SELECT id, household_id, email, role, invited_by, expires_at, accepted_at, created_at
      FROM invitations WHERE household_id = ? ORDER BY created_at, id`).bind(exportRow.household_id).all(),
    env.DB.prepare('SELECT * FROM travelers WHERE household_id = ? ORDER BY created_at, id').bind(exportRow.household_id).all(),
    env.DB.prepare(`SELECT id, household_id, title, start_date, end_date, date_label, journey_type, summary, cover_photo_id, share_expires_at, created_by, created_at, updated_at
      FROM journeys WHERE household_id = ? ORDER BY start_date, id`).bind(exportRow.household_id).all(),
    env.DB.prepare('SELECT * FROM trips WHERE household_id = ? ORDER BY start_date, id').bind(exportRow.household_id).all(),
    env.DB.prepare(`SELECT tt.trip_id, tt.traveler_id FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id
      WHERE t.household_id = ? ORDER BY tt.trip_id, tt.traveler_id`).bind(exportRow.household_id).all(),
    env.DB.prepare(`SELECT id, household_id, trip_id, original_filename, file_size, mime_type, width, height, checksum,
      processing_status, processing_version, processing_error, metadata_source, date_taken, latitude, longitude, caption,
      sort_order, is_cover, rotation, uploaded_at, r2_key, display_r2_key, thumbnail_r2_key
      FROM photos WHERE household_id = ? ORDER BY trip_id, sort_order, id`).bind(exportRow.household_id).all(),
  ]);
  const extensionForKey = key => String(key || '').split('.').pop().replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const media = [];
  for (const photo of photos.results || []) {
    const variants = [
      ['original', photo.r2_key, extensionForKey(photo.r2_key), Number(photo.file_size || 0), photo.checksum || null],
      ['display', photo.display_r2_key, 'jpg', null, null],
      ['thumbnail', photo.thumbnail_r2_key, 'jpg', null, null],
    ];
    for (const [variant, sourceKey, extension, bytes, checksum] of variants) {
      if (!sourceKey || !isSafeMediaKey(sourceKey)) continue;
      const source = await env.MEDIA.head(sourceKey);
      if (!source) throw new Error(`Export source media is missing: photo ${photo.id} ${variant}`);
      media.push({
        photo_id: Number(photo.id),
        variant,
        export_key: exportMediaKey(exportRow.household_id, exportRow.id, photo.id, variant, extension),
        source_key: sourceKey,
        bytes: bytes || Number(source.size || 0),
        checksum: checksum || source.etag || null,
        mime_type: variant === 'original' ? photo.mime_type : 'image/jpeg',
      });
    }
  }
  const manifest = {
    format: 'postcards-household-export',
    version: 1,
    export_id: exportRow.id,
    created_at: new Date().toISOString(),
    household,
    records: {
      members: members.results || [],
      invitations: invitations.results || [],
      travelers: travelers.results || [],
      journeys: journeysRows.results || [],
      trips: trips.results || [],
      trip_travelers: links.results || [],
      photos: (photos.results || []).map(({ r2_key: ignoredOriginal, display_r2_key: ignoredDisplay, thumbnail_r2_key: ignoredThumbnail, ...photo }) => photo),
    },
    media,
  };
  return manifest;
}

function publicHouseholdExportManifest(manifest, requestUrl, householdId, exportId) {
  const media = (Array.isArray(manifest?.media) ? manifest.media : []).map(({ source_key: ignoredSource, export_key: ignoredExport, ...item }) => ({
    ...item,
    download_url: `${new URL(requestUrl).origin}/api/households/current/exports/${encodeURIComponent(exportId)}/media/${encodeURIComponent(item.photo_id)}/${encodeURIComponent(item.variant)}`,
  }));
  return { ...manifest, media };
}

async function runHouseholdExport(env, exportId) {
  let exportRow = await env.DB.prepare('SELECT * FROM data_exports WHERE id = ? LIMIT 1').bind(exportId).first();
  if (!exportRow) throw new Error('Household export record not found');
  if (exportRow.status === 'completed') return;
  if (!exportRow.manifest_key) {
    const manifest = await householdExportManifest(env, exportRow);
    const manifestKey = `${exportPrefix}${exportRow.household_id}/${exportRow.id}/manifest.json`;
    await env.MEDIA.put(manifestKey, encoder.encode(JSON.stringify(manifest)), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    await env.DB.prepare(`UPDATE data_exports SET status = 'running', phase = 'copying_media', manifest_key = ?, media_total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(manifestKey, manifest.media.length, exportId).run();
    exportRow = await env.DB.prepare('SELECT * FROM data_exports WHERE id = ? LIMIT 1').bind(exportId).first();
  }
  const manifestObject = await env.MEDIA.get(exportRow.manifest_key);
  if (!manifestObject) throw new Error('Household export manifest is missing');
  const manifest = JSON.parse(await manifestObject.text());
  const start = Number(exportRow.media_copied || 0);
  const batchSize = Math.max(1, Math.min(25, Number(env.EXPORT_MEDIA_PER_JOB || 10)));
  const batch = (manifest.media || []).slice(start, start + batchSize);
  for (const item of batch) {
    const source = await env.MEDIA.get(item.source_key);
    if (!source) throw new Error(`Export source media disappeared: ${item.source_key}`);
    if (Number(source.size || 0) !== Number(item.bytes || 0)) throw new Error(`Export source media changed: ${item.source_key}`);
    const archive = await env.MEDIA.head(item.export_key);
    if (!archive) await env.MEDIA.put(item.export_key, source.body, { httpMetadata: { contentType: item.mime_type || 'application/octet-stream' }, customMetadata: { sourceEtag: source.etag || '' } });
  }
  const copied = start + batch.length;
  if (copied < manifest.media.length) {
    await env.DB.prepare("UPDATE data_exports SET media_copied = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(copied, exportId).run();
    await enqueueJob(env, { type: 'household_export', householdId: exportRow.household_id, payload: { exportId }, idempotencyKey: `household-export:${exportId}:${copied}` });
    return;
  }
  await env.DB.prepare("UPDATE data_exports SET status = 'completed', phase = 'complete', media_copied = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(copied, exportId).run();
}

export async function cleanupExpiredDataExports(env, limit = 20) {
  const rows = (await env.DB.prepare(`SELECT id, household_id, manifest_key FROM data_exports WHERE datetime(expires_at) <= CURRENT_TIMESTAMP ORDER BY expires_at, id LIMIT ?`).bind(Math.max(1, Math.min(100, Number(limit) || 20))).all()).results || [];
  for (const row of rows) {
    const prefix = `${exportPrefix}${row.household_id}/${row.id}/`;
    let cursor;
    do {
      const page = await env.MEDIA.list({ prefix, cursor });
      await deleteMediaKeys(env, page.objects.map(object => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    await env.DB.prepare('DELETE FROM data_exports WHERE id = ?').bind(row.id).run();
  }
  return rows.length;
}

export async function householdDeletionLock(env, householdId) {
  if (!Number.isInteger(Number(householdId)) || Number(householdId) < 1) return null;
  return env.DB.prepare(`SELECT id, status, phase FROM data_deletions
    WHERE target_household_id = ? AND status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1`).bind(Number(householdId)).first();
}

async function runHouseholdDeletion(env, deletionId) {
  let deletion = await env.DB.prepare('SELECT * FROM data_deletions WHERE id = ? LIMIT 1').bind(deletionId).first();
  if (!deletion) throw new Error('Household deletion record not found');
  if (deletion.status === 'completed') return;
  if (deletion.phase === 'preparing') {
    await createBackup(env, { force: true });
    await env.DB.prepare("UPDATE data_deletions SET status = 'running', phase = 'media', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(deletionId).run();
    deletion = await env.DB.prepare('SELECT * FROM data_deletions WHERE id = ? LIMIT 1').bind(deletionId).first();
  }
  const prefixes = [`households/${deletion.target_household_id}/`, `${deletion.target_household_id}/`];
  const prefixIndex = Number(deletion.media_prefix_index || 0);
  if (prefixIndex < prefixes.length) {
    const page = await env.MEDIA.list({ prefix: prefixes[prefixIndex], cursor: deletion.media_cursor || undefined });
    const keys = page.objects.map(object => object.key).filter(isSafeMediaKey);
    await deleteMediaKeys(env, keys);
    const nextPrefixIndex = page.truncated ? prefixIndex : prefixIndex + 1;
    const nextCursor = page.truncated ? page.cursor : null;
    const deletedCount = Number(deletion.media_deleted || 0) + keys.length;
    await env.DB.prepare('UPDATE data_deletions SET media_prefix_index = ?, media_cursor = ?, media_deleted = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(nextPrefixIndex, nextCursor, deletedCount, deletionId).run();
    await enqueueJob(env, {
      type: 'household_delete',
      householdId: deletion.target_household_id,
      payload: { deletionId },
      idempotencyKey: `household-delete:${deletionId}:${nextPrefixIndex}:${nextCursor || 'done'}`,
    });
    return;
  }
  const exportPrefixForHousehold = `${exportPrefix}${deletion.target_household_id}/`;
  let exportCursor;
  do {
    const page = await env.MEDIA.list({ prefix: exportPrefixForHousehold, cursor: exportCursor });
    await deleteMediaKeys(env, page.objects.map(object => object.key));
    exportCursor = page.truncated ? page.cursor : undefined;
  } while (exportCursor);
  // The original jobs migration used ON DELETE NO ACTION for household_id.
  // Retire all queued/running household jobs in the same transaction before
  // removing the household; the deletion lock prevents new writes/jobs from
  // being created for this household while this operation is in progress.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM jobs WHERE household_id = ?').bind(deletion.target_household_id),
    env.DB.prepare('DELETE FROM households WHERE id = ?').bind(deletion.target_household_id),
  ]);
  await env.DB.prepare("UPDATE data_deletions SET household_id = NULL, status = 'completed', phase = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(deletionId).run();
}

async function enqueueJob(env, { type, payload, householdId = null, idempotencyKey = null }) {
  if (idempotencyKey) {
    const existing = await env.DB.prepare('SELECT id, status FROM jobs WHERE idempotency_key = ? LIMIT 1').bind(idempotencyKey).first();
    if (existing) return { id: existing.id, status: existing.status, created: false };
  }
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO jobs (id, household_id, type, status, payload, idempotency_key)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).bind(id, householdId, type, JSON.stringify(payload || {}), idempotencyKey).run();
  if (!Number(result.meta?.changes || 0) && idempotencyKey) {
    const existing = await env.DB.prepare('SELECT id, status FROM jobs WHERE idempotency_key = ? LIMIT 1').bind(idempotencyKey).first();
    if (existing) return { id: existing.id, status: existing.status, created: false };
  }
  return { id, status: 'pending', created: Number(result.meta?.changes || 0) > 0 };
}

async function claimNextJob(env, leaseMinutes = 5) {
  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + leaseMinutes * 60 * 1000).toISOString();
  return env.DB.prepare(`
    UPDATE jobs
    SET status = 'running', attempts = attempts + 1, lease_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM jobs
      WHERE (status = 'pending' AND available_at <= ?)
         OR (status = 'running' AND lease_expires_at < ?)
      ORDER BY available_at, created_at
      LIMIT 1
    )
    RETURNING *
  `).bind(leaseExpiresAt, now, now).first();
}

async function finishJob(env, job, error = null) {
  if (!error) {
    await env.DB.prepare('UPDATE jobs SET status = \'completed\', lease_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(job.id).run();
    return;
  }
  const attempts = Number(job.attempts || 0);
  const terminal = attempts >= 5;
  const retryAt = new Date(Date.now() + Math.min(60, 2 ** Math.max(attempts - 1, 0)) * 60 * 1000).toISOString();
  await env.DB.prepare(`
    UPDATE jobs
    SET status = ?, available_at = ?, lease_expires_at = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(terminal ? 'failed' : 'pending', retryAt, String(error.message || error).slice(0, 2000), job.id).run();
  if (job.type === 'household_export' || job.type === 'household_delete') {
    let payload = {};
    try { payload = JSON.parse(job.payload || '{}'); } catch { /* The job row remains the source of failure evidence. */ }
    if (job.type === 'household_export') {
      await env.DB.prepare('UPDATE data_exports SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> \'completed\'')
        .bind(terminal ? 'failed' : 'running', String(error.message || error).slice(0, 2000), payload.exportId || null).run();
    } else {
      await env.DB.prepare('UPDATE data_deletions SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> \'completed\'')
        .bind(terminal ? 'failed' : 'running', String(error.message || error).slice(0, 2000), payload.deletionId || null).run();
    }
  }
}

async function runJob(env, job) {
  let payload;
  try { payload = JSON.parse(job.payload || '{}'); } catch { payload = {}; }
  if (job.type === 'media_delete') {
    const keys = Array.isArray(payload.keys) ? payload.keys.filter(isSafeMediaKey) : [];
    await deleteMediaKeys(env, keys);
    return;
  }
  if (job.type === 'location_backfill') {
    const householdId = Number(job.household_id || payload.householdId);
    const afterTripId = Number(payload.afterTripId || 0);
    if (!Number.isInteger(householdId) || householdId < 1) throw new Error('Location backfill job has no household scope');
    if (!Number.isInteger(afterTripId) || afterTripId < 0) throw new Error('Location backfill job has an invalid cursor');
    const result = await runLocationBackfill(env, householdId, { afterTripId });
    if (result.hasMore) {
      await enqueueJob(env, {
        type: 'location_backfill',
        householdId,
        payload: { householdId, afterTripId: result.nextAfterTripId },
        idempotencyKey: `location-backfill:${householdId}:${result.nextAfterTripId}`,
      });
    }
    return;
  }
  if (job.type === 'backup') {
    await createBackup(env, { force: true });
    return;
  }
  if (job.type === 'household_export') {
    const exportId = String(payload.exportId || '');
    if (!exportId) throw new Error('Household export job has no export id');
    await runHouseholdExport(env, exportId);
    return;
  }
  if (job.type === 'household_delete') {
    const deletionId = String(payload.deletionId || '');
    if (!deletionId) throw new Error('Household deletion job has no deletion id');
    await runHouseholdDeletion(env, deletionId);
    return;
  }
  throw new Error(`Unsupported job type: ${job.type}`);
}

async function drainJobs(env, limit = 5) {
  let processed = 0;
  while (processed < limit) {
    const job = await claimNextJob(env);
    if (!job) break;
    try {
      await runJob(env, job);
      await finishJob(env, job);
    } catch (error) {
      console.error(`Postcards job ${job.type} failed`, error);
      await finishJob(env, job, error);
    }
    processed += 1;
  }
  return processed;
}

export async function cleanupOperationalRows(env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM idempotency_keys WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    env.DB.prepare("DELETE FROM provider_cache WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    env.DB.prepare("DELETE FROM upload_reservations WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    env.DB.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR used_at IS NOT NULL AND datetime(used_at) < datetime('now', '-1 day')"),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE datetime(expires_at) <= CURRENT_TIMESTAMP OR used_at IS NOT NULL AND datetime(used_at) < datetime('now', '-1 day')"),
    env.DB.prepare("DELETE FROM auth_rate_limits WHERE datetime(window_started_at) < datetime('now', '-1 day')"),
  ]);
}

export async function cleanupExpiredPhotoUploadSessions(env, limit = 100) {
  const rows = (await env.DB.prepare(`
    SELECT id, household_id, client_upload_id, reservation_token, original_key, display_key, thumbnail_key
    FROM photo_upload_sessions
    WHERE datetime(expires_at) <= CURRENT_TIMESTAMP
    ORDER BY expires_at, id
    LIMIT ?
  `).bind(Math.max(1, Math.min(500, Number(limit) || 100))).all()).results || [];
  if (!rows.length) return 0;
  await deleteMediaKeys(env, distinctMediaKeys(rows.map(row => ({ r2_key: row.original_key, display_r2_key: row.display_key, thumbnail_r2_key: row.thumbnail_key }))));
  await env.DB.batch(rows.flatMap(row => [
    env.DB.prepare('DELETE FROM photo_upload_sessions WHERE id = ?').bind(row.id),
    env.DB.prepare('DELETE FROM upload_reservations WHERE household_id = ? AND reservation_token = ? AND client_upload_id = ?').bind(row.household_id, row.reservation_token, row.client_upload_id),
  ]));
  return rows.length;
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

export function photoJson(row, { shareToken = null } = {}) {
  const mediaQuery = shareToken ? `?share=${encodeURIComponent(shareToken)}` : '';
  const processingStatus = row.processing_status || 'ready';
  const displayKey = row.display_r2_key || row.r2_key;
  const thumbnailKey = row.thumbnail_r2_key || (processingStatus === 'ready' ? row.r2_key : null);
  return {
    id: row.id,
    trip_id: row.trip_id,
    filename: row.original_filename,
    file_path: `${displayKey}${mediaQuery}`,
    thumbnail_path: thumbnailKey ? `${thumbnailKey}${mediaQuery}` : null,
    file_size: row.file_size,
    mime_type: row.mime_type,
    width: row.width,
    height: row.height,
    processing_status: processingStatus,
    processing_error: row.processing_error || null,
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
      placeName: String(body?.placeName || '').trim() || null,
      formattedAddress: String(body?.formattedAddress || '').trim() || null,
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

function journeyInput(body) {
  const title = String(body?.title || '').trim();
  if (!title || title.length > 200) return { error: 'Journey name is required.' };
  const memoryIds = [...new Set((Array.isArray(body?.memoryIds) ? body.memoryIds : [])
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))];
  const coverPhotoId = Number.isInteger(Number(body?.coverPhotoId)) && Number(body.coverPhotoId) > 0
    ? Number(body.coverPhotoId)
    : null;
  return {
    value: {
      title,
      startDate: body?.startDate || null,
      endDate: body?.endDate || null,
      dateLabel: body?.dateLabel || null,
      journeyType: String(body?.journeyType || 'Other').trim().slice(0, 80) || 'Other',
      summary: String(body?.summary || '').slice(0, 20000) || null,
      memoryIds,
      coverPhotoId,
    },
  };
}

async function householdTravelerIds(env, householdId, requestedIds) {
  if (!requestedIds.length) return [];
  const placeholders = requestedIds.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`SELECT id FROM travelers WHERE household_id = ? AND id IN (${placeholders})`).bind(householdId, ...requestedIds).all()).results || [];
  return rows.map(row => row.id);
}

async function householdMemoryIds(env, householdId, requestedIds) {
  if (!requestedIds.length) return [];
  const placeholders = requestedIds.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`SELECT id FROM trips WHERE household_id = ? AND id IN (${placeholders})`).bind(householdId, ...requestedIds).all()).results || [];
  return rows.map(row => row.id);
}

async function assignJourneyMemories(env, householdId, journeyId, requestedIds) {
  const memoryIds = await householdMemoryIds(env, householdId, requestedIds);
  const statements = [
    env.DB.prepare('UPDATE trips SET journey_id = NULL, journey_order = NULL WHERE journey_id = ? AND household_id = ?').bind(journeyId, householdId),
    ...memoryIds.map((memoryId, index) => env.DB.prepare('UPDATE trips SET journey_id = ?, journey_order = ? WHERE id = ? AND household_id = ?').bind(journeyId, index + 1, memoryId, householdId)),
  ];
  await env.DB.batch(statements);
  return memoryIds;
}

function uploadMetadata(formData) {
  try {
    const parsed = JSON.parse(String(formData.get('photoMetadata') || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uploadVariantIndexes(formData, fieldName, count) {
  try {
    const parsed = JSON.parse(String(formData.get(fieldName) || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < count);
  } catch {
    return [];
  }
}

function uploadClientIds(formData, count) {
  const raw = formData.get('photoUploadIds');
  if (raw == null || raw === '') return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    const ids = parsed.map(value => String(value || ''));
    if (ids.some(id => !/^[a-z0-9_-]{8,128}$/i.test(id)) || new Set(ids).size !== ids.length) return null;
    return ids;
  } catch {
    return null;
  }
}

function photoMimeType(file) {
  if (file.type) return String(file.type).toLowerCase();
  const extension = String(file.name || '').toLowerCase().split('.').pop();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }[extension] || '';
}

function asciiBytes(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function imageSignatureMatches(value, mimeType) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value instanceof Uint8Array ? value : new Uint8Array(value || []);
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length >= 8 && asciiBytes(bytes, 0, 8) === '\x89PNG\r\n\x1a\n';
  if (mime === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(asciiBytes(bytes, 0, 6));
  if (mime === 'image/webp') return bytes.length >= 12 && asciiBytes(bytes, 0, 4) === 'RIFF' && asciiBytes(bytes, 8, 4) === 'WEBP';
  if (mime === 'image/heic' || mime === 'image/heif') {
    if (bytes.length < 12 || asciiBytes(bytes, 4, 4) !== 'ftyp') return false;
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis'].includes(asciiBytes(bytes, 8, 4));
  }
  return false;
}

function uploadAttemptId(formData) {
  const supplied = String(formData.get('uploadAttemptId') || '');
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(supplied) ? supplied : randomToken(18);
}

export async function reserveUploadSlots(env, {
  householdId,
  tripId,
  uploads,
  reservationToken,
  maxStorageBytes,
  maxUploadsPerDay,
  maxUploadBytesPerDay,
}) {
  if (!uploads.length) return { ok: true };
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM upload_reservations WHERE household_id = ? AND datetime(expires_at) <= CURRENT_TIMESTAMP").bind(householdId).run();
  const statements = uploads.map(upload => env.DB.prepare(`
    INSERT OR IGNORE INTO upload_reservations
      (id, household_id, trip_id, client_upload_id, reservation_token, file_size, mime_type, expires_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE (
      ? = 0 OR
      (SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE household_id = ?) +
      (SELECT COALESCE(SUM(file_size), 0) FROM upload_reservations WHERE household_id = ? AND datetime(expires_at) > CURRENT_TIMESTAMP) +
      ? <= ?
    )
    AND (
      ? = 0 OR
      (SELECT COUNT(*) FROM photos WHERE household_id = ? AND date(uploaded_at) = date('now')) +
      (SELECT COUNT(*) FROM upload_reservations WHERE household_id = ? AND datetime(expires_at) > CURRENT_TIMESTAMP AND date(created_at) = date('now')) +
      1 <= ?
    )
    AND (
      ? = 0 OR
      (SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE household_id = ? AND date(uploaded_at) = date('now')) +
      (SELECT COALESCE(SUM(file_size), 0) FROM upload_reservations WHERE household_id = ? AND datetime(expires_at) > CURRENT_TIMESTAMP AND date(created_at) = date('now')) +
      ? <= ?
    )
  `).bind(
    crypto.randomUUID(), householdId, tripId, upload.clientUploadId, reservationToken, upload.fileSize, upload.mimeType, expiresAt,
    maxStorageBytes, householdId, householdId, upload.fileSize, maxStorageBytes,
    maxUploadsPerDay, householdId, householdId, maxUploadsPerDay,
    maxUploadBytesPerDay, householdId, householdId, upload.fileSize, maxUploadBytesPerDay,
  ));
  await env.DB.batch(statements);
  const placeholders = uploads.map(() => '?').join(',');
  const rows = (await env.DB.prepare(`
    SELECT client_upload_id, trip_id, file_size, mime_type
    FROM upload_reservations
    WHERE household_id = ? AND reservation_token = ? AND client_upload_id IN (${placeholders})
  `).bind(householdId, reservationToken, ...uploads.map(upload => upload.clientUploadId)).all()).results || [];
  const matches = new Map(rows.map(row => [row.client_upload_id, row]));
  const complete = uploads.every(upload => {
    const row = matches.get(upload.clientUploadId);
    return row && Number(row.trip_id) === Number(tripId) && Number(row.file_size) === Number(upload.fileSize) && row.mime_type === upload.mimeType;
  });
  if (!complete) {
    await env.DB.prepare(`DELETE FROM upload_reservations WHERE household_id = ? AND reservation_token = ? AND client_upload_id IN (${placeholders})`).bind(householdId, reservationToken, ...uploads.map(upload => upload.clientUploadId)).run();
    return { ok: false, reason: 'quota' };
  }
  return { ok: true };
}

async function releaseUploadSlots(env, householdId, reservationToken, clientUploadIds) {
  if (!clientUploadIds.length) return;
  const placeholders = clientUploadIds.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM upload_reservations WHERE household_id = ? AND reservation_token = ? AND client_upload_id IN (${placeholders})`).bind(householdId, reservationToken, ...clientUploadIds).run();
}

function uploadSessionVariant(row, variant) {
  if (variant === 'display') return {
    key: row.display_key,
    expectedBytes: row.display_bytes == null ? null : Number(row.display_bytes),
    checksum: row.display_checksum,
    uploadedAt: row.display_uploaded_at,
    contentType: 'image/jpeg',
  };
  if (variant === 'thumbnail') return {
    key: row.thumbnail_key,
    expectedBytes: row.thumbnail_bytes == null ? null : Number(row.thumbnail_bytes),
    checksum: row.thumbnail_checksum,
    uploadedAt: row.thumbnail_uploaded_at,
    contentType: 'image/jpeg',
  };
  return {
    key: row.original_key,
    expectedBytes: Number(row.original_bytes),
    checksum: row.original_checksum,
    uploadedAt: row.original_uploaded_at,
    contentType: row.mime_type,
  };
}

function uploadSessionJson(row) {
  const base = `/api/photos/upload-sessions/${encodeURIComponent(row.id)}`;
  return {
    id: row.id,
    trip_id: Number(row.trip_id),
    client_upload_id: row.client_upload_id,
    status: row.status,
    expires_at: row.expires_at,
    original: { upload_url: `${base}/original`, bytes: Number(row.original_bytes), mime_type: row.mime_type },
    display: row.display_key ? { upload_url: `${base}/display`, bytes: Number(row.display_bytes), mime_type: 'image/jpeg' } : null,
    thumbnail: row.thumbnail_key ? { upload_url: `${base}/thumbnail`, bytes: Number(row.thumbnail_bytes), mime_type: 'image/jpeg' } : null,
    finalize_url: `${base}/finalize`,
  };
}

function uploadSessionMetadata(body) {
  const latitude = body?.metadata?.latitude == null || body?.metadata?.latitude === '' ? null : Number(body.metadata.latitude);
  const longitude = body?.metadata?.longitude == null || body?.metadata?.longitude === '' ? null : Number(body.metadata.longitude);
  return {
    dateTaken: body?.metadata?.dateTaken ? String(body.metadata.dateTaken).slice(0, 80) : null,
    latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
    rotation: [0, 90, 180, 270].includes(Number(body?.metadata?.rotation)) ? Number(body.metadata.rotation) : 0,
    caption: body?.metadata?.caption ? String(body.metadata.caption).slice(0, 2000) : null,
    isCover: Boolean(body?.metadata?.isCover),
  };
}

async function decorateTrips(env, householdId, conditions = '', values = [], photoOptions = {}, pageOptions = null) {
  const pageCondition = [];
  const pageValues = [];
  if (pageOptions?.cursor) {
    const cursorDate = pageOptions.cursor.date == null ? null : String(pageOptions.cursor.date);
    const cursorId = Number(pageOptions.cursor.id);
    if (cursorDate == null && Number.isInteger(cursorId)) {
      pageCondition.push('(t.start_date IS NULL AND t.id < ?)');
      pageValues.push(cursorId);
    } else if (cursorDate != null && Number.isInteger(cursorId)) {
      pageCondition.push('(t.start_date < ? OR t.start_date IS NULL OR (t.start_date = ? AND t.id < ?))');
      pageValues.push(cursorDate, cursorDate, cursorId);
    }
  }
  const pageLimit = pageOptions ? pageOptions.limit + 1 : null;
  const trips = (await env.DB.prepare(`
    SELECT t.*, j.title AS journey_title FROM trips t
    LEFT JOIN journeys j ON j.id = t.journey_id AND j.household_id = t.household_id
    WHERE t.household_id = ? ${conditions} ${pageCondition.length ? `AND ${pageCondition.join(' AND ')}` : ''}
    ORDER BY t.start_date DESC, t.id DESC
    ${pageOptions ? 'LIMIT ?' : ''}
  `).bind(householdId, ...values, ...pageValues, ...(pageOptions ? [pageLimit] : [])).all()).results || [];
  const hasMore = Boolean(pageOptions && trips.length > pageOptions.limit);
  const pageTrips = pageOptions ? trips.slice(0, pageOptions.limit) : trips;
  if (!pageTrips.length) return pageOptions ? { items: [], next_cursor: null } : [];
  const tripIds = pageTrips.map(trip => trip.id);
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
  const items = pageTrips.map(trip => ({
    ...trip,
    travelers: travelers.filter(item => item.trip_id === trip.id).map(({ trip_id: ignored, ...traveler }) => ({ ...traveler, is_active: Boolean(traveler.is_active) })),
    photos: photos.filter(item => item.trip_id === trip.id).map(item => photoJson(item, photoOptions)),
  }));
  if (!pageOptions) return items;
  const last = pageTrips[pageTrips.length - 1];
  return {
    items,
    next_cursor: hasMore ? encodePageCursor({ date: last.start_date || null, id: Number(last.id) }) : null,
  };
}

async function journeys(env, householdId, publicToken = null, journeyId = null, pageOptions = null) {
  let statement;
  if (publicToken) {
    statement = env.DB.prepare(`SELECT * FROM journeys WHERE share_token = ? AND (share_expires_at IS NULL OR datetime(share_expires_at) > CURRENT_TIMESTAMP) LIMIT 1`).bind(publicToken);
  } else if (journeyId != null) {
    statement = env.DB.prepare('SELECT * FROM journeys WHERE household_id = ? AND id = ? LIMIT 1').bind(householdId, journeyId);
  } else {
    const pageCondition = [];
    const pageValues = [];
    if (pageOptions?.cursor) {
      const cursorDate = pageOptions.cursor.date == null ? null : String(pageOptions.cursor.date);
      const cursorId = Number(pageOptions.cursor.id);
      if (cursorDate == null && Number.isInteger(cursorId)) {
        pageCondition.push('(start_date IS NULL AND id < ?)');
        pageValues.push(cursorId);
      } else if (cursorDate != null && Number.isInteger(cursorId)) {
        pageCondition.push('(start_date < ? OR start_date IS NULL OR (start_date = ? AND id < ?))');
        pageValues.push(cursorDate, cursorDate, cursorId);
      }
    }
    statement = env.DB.prepare(`
      SELECT * FROM journeys
      WHERE household_id = ? ${pageCondition.length ? `AND ${pageCondition.join(' AND ')}` : ''}
      ORDER BY start_date DESC, id DESC
      ${pageOptions ? 'LIMIT ?' : ''}
    `).bind(householdId, ...pageValues, ...(pageOptions ? [pageOptions.limit + 1] : []));
  }
  const rawRows = publicToken || journeyId != null
    ? [await statement.first()].filter(Boolean)
    : ((await statement.all()).results || []);
  const hasMore = Boolean(pageOptions && rawRows.length > pageOptions.limit);
  const rows = pageOptions ? rawRows.slice(0, pageOptions.limit) : rawRows;
  if (!rows.length) return pageOptions ? { items: [], next_cursor: null } : [];
  const journeyIds = rows.map(row => Number(row.id));
  const journeyPlaceholders = journeyIds.map(() => '?').join(',');
  const allTrips = await decorateTrips(
    env,
    publicToken ? rows[0].household_id : householdId,
    `AND t.journey_id IN (${journeyPlaceholders})`,
    journeyIds,
    publicToken ? { shareToken: publicToken } : {},
  );
  const items = rows.map(row => ({
    ...row,
    memories: allTrips
      .filter(trip => trip.journey_id === row.id)
      .sort((a, b) => (a.journey_order ?? 999999) - (b.journey_order ?? 999999) || String(a.start_date || '').localeCompare(String(b.start_date || '')) || a.id - b.id),
  }));
  if (!pageOptions) return items;
  const last = rows[rows.length - 1];
  return {
    items,
    next_cursor: hasMore ? encodePageCursor({ date: last.start_date || null, id: Number(last.id) }) : null,
  };
}

async function analyticsTripRows(env, householdId, configuredLimit = 5000) {
  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM trips WHERE household_id = ?').bind(householdId).first();
  const totalTrips = Number(totalRow?.count || 0);
  const limit = Math.min(Math.max(Number(configuredLimit) || 5000, 100), 20000);
  const trips = (await env.DB.prepare(`
    SELECT * FROM trips WHERE household_id = ? ORDER BY start_date, id LIMIT ?
  `).bind(householdId, limit).all()).results || [];
  if (!trips.length) return { trips: [], totalTrips, truncated: false };
  const tripIds = trips.map(trip => trip.id);
  const placeholders = tripIds.map(() => '?').join(',');
  const travelers = (await env.DB.prepare(`
    SELECT tt.trip_id, tr.id, tr.name, tr.relationship, tr.is_active
    FROM trip_travelers tt JOIN travelers tr ON tr.id = tt.traveler_id
    WHERE tt.trip_id IN (${placeholders}) AND tr.household_id = ?
    ORDER BY tr.id
  `).bind(...tripIds, householdId).all()).results || [];
  return { trips: trips.map(trip => ({
    ...trip,
    travelers: travelers
      .filter(item => item.trip_id === trip.id)
      .map(({ trip_id: ignored, ...traveler }) => ({ ...traveler, is_active: Boolean(traveler.is_active) })),
    photos: [],
  })), totalTrips, truncated: totalTrips > trips.length };
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

async function locationBackfillCandidates(env, householdId, afterTripId = 0, limit = 100) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 101);
  return (await env.DB.prepare(`
    SELECT t.id AS trip_id, t.location_name, t.start_date, t.date_label,
      p.id AS photo_id, p.latitude, p.longitude, p.date_taken
    FROM trips t
    JOIN photos p ON p.id = (
      SELECT candidate.id FROM photos candidate
      WHERE candidate.trip_id = t.id AND candidate.household_id = t.household_id
        AND candidate.latitude IS NOT NULL AND candidate.longitude IS NOT NULL
      ORDER BY candidate.date_taken, candidate.id LIMIT 1
    )
    WHERE t.household_id = ?
      AND t.id > ?
      AND (t.location_name IS NULL OR TRIM(t.location_name) = '' OR LOWER(t.location_name) LIKE 'unknown%')
    ORDER BY t.id
    LIMIT ?
  `).bind(householdId, afterTripId, boundedLimit).all()).results || [];
}

export function locationBackfillWorkPlan(candidates, maxPerRun = 3) {
  const boundedMax = Math.min(Math.max(Number(maxPerRun) || 3, 1), 100);
  const processed = candidates.slice(0, boundedMax);
  return {
    processed,
    hasMore: candidates.length > processed.length,
    nextAfterTripId: processed.length ? Number(processed[processed.length - 1].trip_id) : null,
  };
}

async function runLocationBackfill(env, householdId, { afterTripId = 0 } = {}) {
  const maxPerRun = Math.min(Math.max(1, Number(env.MAX_LOCATION_BACKFILL_PER_RUN || 3)), 10);
  const candidates = await locationBackfillCandidates(env, householdId, afterTripId, maxPerRun + 1);
  const work = locationBackfillWorkPlan(candidates, maxPerRun);
  const updated = [];
  const skipped = [];
  for (const candidate of work.processed) {
    try {
      const location = await reverseGeocodeLocation(env, candidate.latitude, candidate.longitude);
      const name = location?.displayName || location?.city || location?.state || location?.country;
      if (!name) {
        skipped.push({ ...candidate, reason: 'No place match found' });
        continue;
      }
      const result = await env.DB.prepare(`
        UPDATE trips SET location_name = ?, place_name = COALESCE(NULLIF(place_name, ''), ?), formatted_address = COALESCE(NULLIF(formatted_address, ''), ?),
          city = COALESCE(NULLIF(city, ''), ?), state = COALESCE(NULLIF(state, ''), ?), country = COALESCE(NULLIF(country, ''), ?),
          latitude = COALESCE(latitude, ?), longitude = COALESCE(longitude, ?),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND household_id = ?
          AND (location_name IS NULL OR TRIM(location_name) = '' OR LOWER(location_name) LIKE 'unknown%')
        RETURNING id
      `).bind(name, location.displayName || null, location.formattedAddress || null, location.city, location.state, location.country, candidate.latitude, candidate.longitude, candidate.trip_id, householdId).first();
      if (result) {
        updated.push({ tripId: candidate.trip_id, photoId: candidate.photo_id, locationName: name, placeName: location.displayName || null, formattedAddress: location.formattedAddress || null, city: location.city, state: location.state, country: location.country, latitude: candidate.latitude, longitude: candidate.longitude });
      } else {
        skipped.push({ ...candidate, reason: 'Memory was already updated' });
      }
    } catch (error) {
      console.error('Postcards location lookup failed', { tripId: candidate.trip_id, error: String(error?.message || error) });
      throw error;
    }
  }
  return {
    found: candidates.length,
    processed: work.processed.length,
    updated,
    skipped,
    remaining: work.hasMore ? candidates.length - work.processed.length : 0,
    hasMore: work.hasMore,
    nextAfterTripId: work.nextAfterTripId,
  };
}

const importTables = {
  households: ['id', 'slug', 'name', 'created_at', 'updated_at'],
  users: ['id', 'username', 'email', 'email_verified_at', 'site_admin', 'password_hash', 'password_updated_at', 'display_name', 'created_at'],
  household_members: ['household_id', 'user_id', 'role', 'created_at'],
  travelers: ['id', 'household_id', 'name', 'relationship', 'is_active', 'created_at'],
  journeys: ['id', 'household_id', 'title', 'start_date', 'end_date', 'date_label', 'journey_type', 'summary', 'cover_photo_id', 'share_token', 'share_expires_at', 'created_by', 'created_at', 'updated_at'],
  trips: ['id', 'household_id', 'location_name', 'place_name', 'formatted_address', 'city', 'latitude', 'longitude', 'country', 'state', 'start_date', 'end_date', 'date_label', 'date_precision', 'trip_type', 'notes', 'journey_id', 'journey_order', 'home_distance_miles', 'created_by', 'created_at', 'updated_at'],
  trip_travelers: ['trip_id', 'traveler_id'],
  photos: ['id', 'household_id', 'trip_id', 'client_upload_id', 'r2_key', 'display_r2_key', 'thumbnail_r2_key', 'original_filename', 'file_size', 'mime_type', 'width', 'height', 'processing_status', 'processing_version', 'metadata_source', 'date_taken', 'latitude', 'longitude', 'caption', 'sort_order', 'is_cover', 'rotation', 'uploaded_at'],
  audit_events: ['id', 'user_id', 'household_id', 'action', 'resource_type', 'resource_id', 'metadata', 'created_at'],
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
  let objectBytes = 0;
  let cursor;
  do {
    const page = await env.MEDIA.list({ cursor });
    objectCount += page.objects.length;
    objectBytes += page.objects.reduce((sum, object) => sum + Number(object.size || 0), 0);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return json({ counts: Object.fromEntries(tables.map((table, index) => [table, Number(results[index].results?.[0]?.count || 0)])), mediaObjects: objectCount, mediaBytes: objectBytes });
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

async function handleFetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'Cross-origin request blocked' }, { status: 403 });
      if (cookieValue(request, 'postcards_session')) {
        const referer = request.headers.get('referer') || '';
        const sameOriginReferer = referer.startsWith(`${url.origin}/`);
        if (origin !== url.origin && !sameOriginReferer) return json({ error: 'CSRF validation failed' }, { status: 403 });
      }
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
        if (!isSafeMediaKey(key) || !key.startsWith('households/')) return json({ error: 'Invalid media key' }, { status: 400 });
        const bytes = await request.arrayBuffer();
        const actualSha256 = hexDigest(await crypto.subtle.digest('SHA-256', bytes));
        const expectedSha256 = String(request.headers.get('x-source-sha256') || '').toLowerCase();
        if (expectedSha256 && expectedSha256 !== actualSha256) return json({ error: 'Media checksum mismatch' }, { status: 400 });
        await env.MEDIA.put(key, bytes, {
          httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' },
          customMetadata: { migrationSha256: actualSha256 },
        });
        return json({ key, bytes: bytes.byteLength, sha256: actualSha256 });
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
      if (!featureEnabled(env, 'ENABLE_BACKUP_RUNNER', false) || !secretAuthorized(request, env.BACKUP_TOKEN, 'x-backup-token')) return json({ error: 'Not found' }, { status: 404 });
      try { return json(await createBackup(env, { force: true })); }
      catch (error) {
        console.error('Postcards backup failed', error);
        return json({ error: 'Backup failed' }, { status: 500 });
      }
    }

    if (url.pathname.startsWith('/photos/') && request.method === 'GET') {
      const key = decodeURIComponent(url.pathname.slice('/photos/'.length));
      if (!isSafeMediaKey(key)) return new Response('Not found', { status: 404 });
      const shareToken = url.searchParams.get('share');
      let mediaAuthorized = false;
      if (shareToken) {
        const sharedPhoto = await env.DB.prepare(`
          SELECT p.id
          FROM photos p
          JOIN trips t ON t.id = p.trip_id AND t.household_id = p.household_id
          JOIN journeys j ON j.id = t.journey_id AND j.household_id = t.household_id
          WHERE (p.r2_key = ? OR p.display_r2_key = ? OR p.thumbnail_r2_key = ?)
            AND j.share_token = ?
            AND (j.share_expires_at IS NULL OR datetime(j.share_expires_at) > CURRENT_TIMESTAMP)
          LIMIT 1
        `).bind(key, key, key, shareToken).first();
        mediaAuthorized = Boolean(sharedPhoto);
      } else {
        const user = await authenticate(request, env);
        if (user?.household_id != null) {
          const ownedPhoto = await env.DB.prepare(
            'SELECT id FROM photos WHERE (r2_key = ? OR display_r2_key = ? OR thumbnail_r2_key = ?) AND household_id = ? LIMIT 1',
          ).bind(key, key, key, user.household_id).first();
          mediaAuthorized = Boolean(ownedPhoto);
        }
      }
      if (!mediaAuthorized) return new Response('Not found', { status: 404 });
      const object = await env.MEDIA.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('content-disposition', 'inline');
      headers.set('cache-control', shareToken ? 'public, max-age=300' : 'private, no-store');
      headers.set('x-content-type-options', 'nosniff');
      return new Response(object.body, { headers });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await parseJson(request);
        const email = normalizeEmail(body?.email);
        if (!validEmail(email) || !body?.password) return json({ error: 'Email and password required' }, { status: 400 });
        // The Ubuntu source used usernames instead of email addresses. During
        // the first successful beta login, allow the email's local part to
        // identify an imported account whose email is still empty, then save
        // the verified account owner-provided address for recovery/invites.
        const legacyUsername = email.slice(0, email.indexOf('@'));
        if (!(await rateLimit(env, 'login', requestFingerprint(request, email), 10, 15 * 60))) {
          return json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }, { status: 429 });
        }
        const user = await env.DB.prepare(`
          SELECT id, username, email, email_verified_at, site_admin, password_hash, display_name
          FROM users WHERE email = ? OR (email IS NULL AND lower(username) = lower(?)) LIMIT 1
        `).bind(email, legacyUsername).first();
        if (!user) {
          await hashPassword(body.password);
          return json({ error: 'Invalid email or password' }, { status: 401 });
        }
        if (!(await verifyPassword(body.password, user.password_hash))) return json({ error: 'Invalid email or password' }, { status: 401 });
        if (!user.email && String(user.username || '').toLowerCase() === legacyUsername.toLowerCase()) {
          await env.DB.prepare('UPDATE users SET email = ? WHERE id = ? AND email IS NULL').bind(email, user.id).run();
          user.email = email;
        }
        if (!String(user.password_hash).startsWith('pbkdf2_sha256$')) {
          try {
            const upgradedHash = await hashPassword(body.password);
            await env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(upgradedHash, user.id).run();
          } catch (error) {
            console.error('Password hash upgrade deferred', error);
          }
        }
        await env.DB.prepare("DELETE FROM auth_rate_limits WHERE action = 'login' AND key = ?").bind(await sha256(`login:${requestFingerprint(request, email)}`)).run();
        const session = await createSession(env, user.id);
        const households = await userHouseholds(env, user.id);
        const userPayload = toPublicUser(user);
        return json({ user: userPayload, households, active_household_id: session.householdId }, { headers: { 'set-cookie': sessionCookie(session.token) } });
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
      if (!(await rateLimit(env, 'register-invite-ip', requestFingerprint(request), 20, 60 * 60))) {
        return json({ error: 'Too many account creation attempts. Please wait before trying again.' }, { status: 429 });
      }
      const invitationIdentity = await env.DB.prepare('SELECT id, household_id FROM invitations WHERE token_hash = ? LIMIT 1').bind(await sha256(body?.token || '')).first();
      const idempotency = invitationIdentity
        ? await claimIdempotency(
          env,
          request,
          { id: `invitation:${invitationIdentity.id}`, household_id: invitationIdentity.household_id },
          'auth.register-invite',
          body,
        )
        : null;
      if (idempotency?.response) return idempotency.response;
      const invitation = await invitationByToken(env, body?.token);
      if (!invitation) {
        await releaseIdempotency(env, idempotency);
        return json({ error: 'This invitation is invalid or has expired.' }, { status: 400 });
      }
      if (invitation.account_exists) {
        await releaseIdempotency(env, idempotency);
        return json({ error: 'An account already uses this email. Sign in to accept the invitation.' }, { status: 409 });
      }
      if (!(await rateLimit(env, 'register-invite', requestFingerprint(request, invitation.email), 8, 60 * 60))) {
        await releaseIdempotency(env, idempotency);
        return json({ error: 'Too many account creation attempts. Please wait before trying again.' }, { status: 429 });
      }
      const problem = passwordProblem(body?.password);
      if (problem) {
        await releaseIdempotency(env, idempotency);
        return json({ error: problem }, { status: 400 });
      }
      const displayName = String(body?.displayName || '').trim();
      if (displayName.length < 2 || displayName.length > 80) {
        await releaseIdempotency(env, idempotency);
        return json({ error: 'Enter your name.' }, { status: 400 });
      }
      const passwordHash = await hashPassword(body.password);
      try {
        await env.DB.prepare(`
          INSERT INTO users (username, email, email_verified_at, password_hash, password_updated_at, display_name)
          VALUES (?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, ?)
        `).bind(invitation.email, invitation.email, passwordHash, displayName).run();
      } catch (error) {
        await releaseIdempotency(env, idempotency);
        console.error('Invited registration failed', error);
        return json({ error: 'That email already has an account. Sign in instead.' }, { status: 409 });
      }
      const user = await env.DB.prepare('SELECT id, email, email_verified_at, site_admin, display_name FROM users WHERE email = ?').bind(invitation.email).first();
      try {
        const membership = await env.DB.prepare(`
          INSERT INTO household_members (household_id, user_id, role)
          SELECT ?, ?, ?
          WHERE (SELECT COUNT(*) FROM household_members WHERE household_id = ?) < 2
          RETURNING household_id
        `).bind(invitation.household_id, user.id, invitation.role, invitation.household_id).first();
        if (!membership) {
          await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
          await releaseIdempotency(env, idempotency);
          return json({ error: 'This memory site already has its owner and one additional user.' }, { status: 409 });
        }
        await env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invitation.id).run();
        const session = await createSession(env, user.id, invitation.household_id);
        const responseBody = { user: toPublicUser(user), households: await userHouseholds(env, user.id), active_household_id: invitation.household_id };
        await completeIdempotency(env, idempotency, responseBody, 201);
        return json(responseBody, { status: 201, headers: { 'set-cookie': sessionCookie(session.token) } });
      } catch (error) {
        await releaseIdempotency(env, idempotency);
        throw error;
      }
    }

    if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
      const body = await parseJson(request);
      const email = normalizeEmail(body?.email);
      const generic = { message: 'If an account uses that email, a reset link is on its way.' };
      if (!validEmail(email)) return json(generic);
      if (!(await rateLimit(env, 'forgot-password', requestFingerprint(request, email), 5, 60 * 60))) return json(generic);
      // A password reset link proves mailbox ownership just as effectively as
      // an email-verification link. Allow imported accounts whose email was
      // captured during the legacy login bridge to recover, then mark the
      // address verified when the one-time reset link is consumed.
      const user = await env.DB.prepare('SELECT id, email, display_name FROM users WHERE email = ?').bind(email).first();
      if (user) {
        const tokenId = crypto.randomUUID();
        const rawToken = randomToken();
        await env.DB.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(tokenId, user.id, await sha256(rawToken), new Date(Date.now() + 60 * 60 * 1000).toISOString()).run();
        ctx.waitUntil(sendPasswordResetEmail(env, request, user, rawToken, tokenId).catch(async error => {
          console.error('Password reset email failed', error);
          await recordOperationalEvent(env, { action: 'email_failed', requestId: tokenId, route: '/api/auth/forgot-password', userId: user.id, metadata: { kind: 'password-reset' } });
          await env.DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(tokenId).run();
        }));
      }
      return json(generic);
    }

    if (url.pathname === '/api/auth/verify-email' && request.method === 'POST') {
      const body = await parseJson(request);
      if (!(await rateLimit(env, 'verify-email', requestFingerprint(request), 10, 60 * 60))) {
        return json({ error: 'Too many verification attempts. Please wait before trying again.' }, { status: 429 });
      }
      const token = await env.DB.prepare(`
        SELECT id, user_id
        FROM email_verification_tokens
        WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP
        LIMIT 1
      `).bind(await sha256(body?.token || '')).first();
      if (!token) return json({ error: 'This verification link is invalid or has expired.' }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').bind(token.user_id),
        env.DB.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(token.id),
      ]);
      return json({ success: true, message: 'Your email has been verified. You can sign in and recover your account with it.' });
    }

    if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
      const body = await parseJson(request);
      if (!(await rateLimit(env, 'reset-password', requestFingerprint(request), 10, 60 * 60))) {
        return json({ error: 'Too many password reset attempts. Please wait before trying again.' }, { status: 429 });
      }
      const problem = passwordProblem(body?.password);
      if (problem) return json({ error: problem }, { status: 400 });
      const reset = await env.DB.prepare(`
        SELECT pr.id, pr.user_id, u.email, u.display_name
        FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id
        WHERE pr.token_hash = ? AND pr.used_at IS NULL AND datetime(pr.expires_at) > CURRENT_TIMESTAMP LIMIT 1
      `).bind(await sha256(body?.token || '')).first();
      if (!reset) return json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?').bind(await hashPassword(body.password), reset.user_id),
        env.DB.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(reset.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(reset.user_id),
      ]);
      try {
        await sendEmail(env, { to: reset.email, subject: 'Your Postcards of Us password was changed', text: 'Your Postcards of Us password was changed. If this was not you, reply to this email immediately.', html: '<p>Your Postcards of Us password was changed.</p><p>If this was not you, reply to this email immediately.</p>', idempotencyKey: `postcards-password-changed-${reset.id}` });
      } catch (error) { console.error('Password change confirmation failed', error); }
      return json({ success: true, message: 'Password updated. Sign in with your new password.' }, { headers: { 'set-cookie': clearSessionCookie() } });
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
          user: toPublicUser(user),
          households: await userHouseholds(env, user.id),
          active_household_id: user.household_id,
        });
      }

      if (url.pathname === '/api/feedback/bugs' && request.method === 'POST') {
        if (!(await rateLimit(env, 'bug-report', requestFingerprint(request, String(user.id)), 5, 60 * 60))) {
          return json({ error: 'You have sent several reports recently. Please try again later.' }, { status: 429 });
        }
        const isMultipart = String(request.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data');
        let body;
        let screenshotFile = null;
        if (isMultipart) {
          const formData = await request.formData();
          body = {
            title: formData.get('title'),
            details: formData.get('details'),
            context: formData.get('context'),
          };
          const file = formData.get('screenshot');
          if (file && typeof file.arrayBuffer === 'function') screenshotFile = file;
        } else {
          body = await parseJson(request);
        }
        const title = String(body?.title || '').trim();
        const details = String(body?.details || '').trim();
        if (!title || title.length > 120) return json({ error: 'Add a short bug title.' }, { status: 400 });
        if (!details || details.length > 4000) return json({ error: 'Add details in 4,000 characters or fewer.' }, { status: 400 });
        let suppliedContext = body?.context;
        if (typeof suppliedContext === 'string') {
          try { suppliedContext = JSON.parse(suppliedContext); } catch { suppliedContext = {}; }
        }
        suppliedContext = suppliedContext && typeof suppliedContext === 'object' && !Array.isArray(suppliedContext)
          ? suppliedContext
          : {};
        let screenshot = null;
        if (screenshotFile) {
          const contentType = String(screenshotFile.type || '').toLowerCase();
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
            return json({ error: 'Attach a PNG, JPG, or WebP screenshot.' }, { status: 400 });
          }
          const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
          screenshot = {
            filename: String(screenshotFile.name || `screenshot.${extension}`).replace(/[\\/]/g, '_').slice(0, 160),
            contentType,
            bytes: await screenshotFile.arrayBuffer(),
            size: Number(screenshotFile.size || 0),
            extension,
          };
        }
        const reportId = crypto.randomUUID();
        let screenshotKey = null;
        if (screenshot && env.MEDIA) {
          screenshotKey = `bug-reports/${user.household_id || 'account'}/${reportId}.${screenshot.extension}`;
          await env.MEDIA.put(screenshotKey, screenshot.bytes, {
            httpMetadata: { contentType: screenshot.contentType },
            customMetadata: { reportId, userId: String(user.id) },
          });
        }
        await recordAudit(env, {
          userId: user.id,
          householdId: user.household_id,
          action: 'bug.reported',
          resourceType: 'bug_report',
          resourceId: reportId,
          metadata: {
            title,
            details,
            requestId: String(suppliedContext.requestId || '').slice(0, 120) || null,
            page: String(suppliedContext.page || '').slice(0, 200) || null,
            url: String(suppliedContext.url || '').slice(0, 500) || null,
            appVersion: String(suppliedContext.appVersion || '').slice(0, 40) || null,
            userAgent: String(suppliedContext.userAgent || request.headers.get('user-agent') || '').slice(0, 500) || null,
            screenshot: screenshot ? {
              filename: screenshot.filename,
              contentType: screenshot.contentType,
              size: screenshot.size,
              key: screenshotKey,
            } : null,
            githubIssue: null,
          },
        });
        if (env.BUG_REPORT_TO) {
          ctx.waitUntil(sendBugReportNotification(env, {
            reportId,
            title,
            details,
            context: suppliedContext,
            user,
            screenshot,
          }).catch(async error => {
            console.error('Postcards bug report email failed', error);
            await recordOperationalEvent(env, {
              action: 'email_failed',
              requestId: reportId,
              route: '/api/feedback/bugs',
              userId: user.id,
              householdId: user.household_id,
              metadata: { kind: 'bug_report', recipient: String(env.BUG_REPORT_TO).slice(0, 254) },
            });
          }));
        }
        return json({ id: reportId, message: 'Thanks — your report was saved.' }, { status: 201 });
      }

      const githubIssueMatch = url.pathname.match(/^\/api\/admin\/bug-reports\/([A-Za-z0-9-]+)\/github-issue$/);
      if (githubIssueMatch && request.method === 'POST') {
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        if (!env.GITHUB_TOKEN) return json({ error: 'GitHub issue publishing is not configured.' }, { status: 503 });
        const repository = githubRepository(env);
        if (!repository) return json({ error: 'GitHub repository configuration is invalid.' }, { status: 503 });
        const reportId = githubIssueMatch[1];
        const row = await env.DB.prepare(`
          SELECT id, metadata
          FROM audit_events
          WHERE action = 'bug.reported' AND resource_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(reportId).first();
        if (!row) return json({ error: 'Bug report not found.' }, { status: 404 });
        const metadata = parseAuditMetadata(row.metadata);
        if (metadata.githubIssue?.url) return json({ githubIssue: metadata.githubIssue });

        try {
          const issue = await githubJson(env, `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues`, {
            method: 'POST',
            body: JSON.stringify({
              title: `[Postcards] ${String(metadata.title || 'Bug report').slice(0, 120)}`,
              body: githubIssueBody(reportId, metadata),
              labels: [GITHUB_LABEL],
            }),
          });
          const githubIssue = { id: issue.id, number: issue.number, url: issue.html_url, label: GITHUB_LABEL, created_at: new Date().toISOString() };
          await env.DB.prepare('UPDATE audit_events SET metadata = ? WHERE id = ?').bind(JSON.stringify({ ...metadata, githubIssue }), row.id).run();
          return json({ githubIssue }, { status: 201 });
        } catch (error) {
          console.error('GitHub bug issue creation failed', error);
          return json({ error: error.message || 'The GitHub issue could not be created.' }, { status: 502 });
        }
      }

      const bugScreenshotMatch = url.pathname.match(/^\/api\/admin\/bug-reports\/([A-Za-z0-9-]+)\/screenshot$/);
      if (bugScreenshotMatch && request.method === 'GET') {
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        const row = await env.DB.prepare(`
          SELECT metadata
          FROM audit_events
          WHERE action = 'bug.reported' AND resource_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(bugScreenshotMatch[1]).first();
        const metadata = parseAuditMetadata(row?.metadata);
        const key = String(metadata.screenshot?.key || '');
        if (!row || !key.startsWith('bug-reports/') || !env.MEDIA) return new Response('Not found', { status: 404 });
        const object = await env.MEDIA.get(key);
        if (!object) return new Response('Not found', { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        if (!headers.has('content-type') && metadata.screenshot.contentType) headers.set('content-type', metadata.screenshot.contentType);
        headers.set('content-disposition', `inline; filename="${inlineFilename(metadata.screenshot.filename)}"`);
        headers.set('cache-control', 'private, no-store');
        headers.set('x-content-type-options', 'nosniff');
        return new Response(object.body, { headers });
      }

      if (url.pathname.startsWith('/api/admin/bug-reports/') && request.method === 'DELETE') {
        const reportId = decodeURIComponent(url.pathname.slice('/api/admin/bug-reports/'.length));
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        const row = await env.DB.prepare(`
          SELECT id, household_id, metadata
          FROM audit_events
          WHERE action = 'bug.reported' AND resource_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(reportId).first();
        if (!row) return json({ error: 'Bug report not found.' }, { status: 404 });
        const metadata = parseAuditMetadata(row.metadata);
        const key = String(metadata.screenshot?.key || '');
        if (key.startsWith('bug-reports/') && env.MEDIA) await env.MEDIA.delete(key);
        await env.DB.prepare('DELETE FROM audit_events WHERE id = ?').bind(row.id).run();
        await recordAudit(env, {
          userId: user.id,
          householdId: user.household_id,
          action: 'bug.deleted',
          resourceType: 'bug_report',
          resourceId: reportId,
          metadata: { title: metadata.title || null },
        });
        return json({ deleted: reportId });
      }

      if (url.pathname === '/api/auth/resend-verification' && request.method === 'POST') {
        if (user.email_verified_at) return json({ success: true, message: 'Your email is already verified.' });
        if (!validEmail(user.email)) return json({ error: 'A valid account email is required before verification can be sent.' }, { status: 400 });
        const tokenId = crypto.randomUUID();
        const rawToken = randomToken();
        await env.DB.prepare('INSERT INTO email_verification_tokens (id, user_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)').bind(tokenId, user.id, user.email, await sha256(rawToken), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()).run();
        ctx.waitUntil(sendVerificationEmail(env, request, user, rawToken, tokenId).catch(async error => {
          console.error('Verification email failed', error);
          await recordOperationalEvent(env, { action: 'email_failed', requestId: tokenId, route: '/api/auth/resend-verification', userId: user.id, householdId: user.household_id, metadata: { kind: 'verification' } });
          await env.DB.prepare('DELETE FROM email_verification_tokens WHERE id = ?').bind(tokenId).run();
        }));
        return json({ success: true, message: 'If your account email can receive mail, a verification link is on its way.' });
      }

      const deletionRoute = url.pathname.startsWith('/api/households/current/deletion');
      if (user.household_id && request.method !== 'GET' && url.pathname !== '/api/auth/logout' && !deletionRoute) {
        const deletionLock = await householdDeletionLock(env, user.household_id);
        if (deletionLock) return json({ error: 'This household is locked while its deletion request is being processed.' }, { status: 423, headers: { 'retry-after': '30' } });
      }

      const exportRoleDenied = !['owner', 'admin'].includes(user.role)
        ? json({ error: 'Only household owners and administrators can manage exports.' }, { status: 403 })
        : null;
      if (url.pathname === '/api/households/current/exports' && request.method === 'POST') {
        if (exportRoleDenied) return exportRoleDenied;
        if (!user.household_id) return json({ error: 'Select a household before requesting an export.' }, { status: 400 });
        const body = await parseJson(request);
        const idempotency = await claimIdempotency(env, request, user, 'household.export.create', { householdId: user.household_id, body });
        if (idempotency?.response) return idempotency.response;
        try {
          const active = await env.DB.prepare(`
            SELECT * FROM data_exports WHERE household_id = ? AND status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1
          `).bind(user.household_id).first();
          if (active) {
            const responseBody = { export_id: active.id, status: active.status, phase: active.phase, media_total: Number(active.media_total || 0), media_copied: Number(active.media_copied || 0), created_at: active.created_at, updated_at: active.updated_at };
            await completeIdempotency(env, idempotency, responseBody, 202);
            return json(responseBody, { status: 202, headers: { 'retry-after': '10' } });
          }
          const exportId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
          await env.DB.prepare(`
            INSERT INTO data_exports (id, household_id, requested_by, status, phase, expires_at)
            VALUES (?, ?, ?, 'pending', 'preparing', ?)
          `).bind(exportId, user.household_id, user.id, expiresAt).run();
          const queued = await enqueueJob(env, {
            type: 'household_export',
            householdId: user.household_id,
            payload: { exportId },
            idempotencyKey: `household-export:${exportId}:0`,
          });
          const responseBody = { export_id: exportId, job_id: queued.id, status: 'pending', phase: 'preparing', media_total: 0, media_copied: 0, expires_at: expiresAt };
          await completeIdempotency(env, idempotency, responseBody, 202);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'household.export_requested', resourceType: 'data_export', resourceId: exportId }));
          return json(responseBody, { status: 202, headers: { 'retry-after': '10' } });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/households/current/exports' && request.method === 'GET') {
        if (exportRoleDenied) return exportRoleDenied;
        const rows = (await env.DB.prepare(`SELECT id, status, phase, media_total, media_copied, expires_at, created_at, updated_at, last_error
          FROM data_exports WHERE household_id = ? ORDER BY created_at DESC LIMIT 20`).bind(user.household_id).all()).results || [];
        return json({ exports: rows.map(row => ({ ...row, media_total: Number(row.media_total || 0), media_copied: Number(row.media_copied || 0) })) });
      }

      const exportMediaMatch = url.pathname.match(/^\/api\/households\/current\/exports\/([A-Za-z0-9_-]+)\/media\/(\d+)\/(original|display|thumbnail)$/);
      if (exportMediaMatch && request.method === 'GET') {
        if (exportRoleDenied) return exportRoleDenied;
        const exportRow = await env.DB.prepare('SELECT * FROM data_exports WHERE id = ? AND household_id = ? LIMIT 1').bind(exportMediaMatch[1], user.household_id).first();
        if (!exportRow || exportRow.status !== 'completed') return new Response('Not found', { status: 404 });
        const manifestObject = await env.MEDIA.get(exportRow.manifest_key);
        if (!manifestObject) return new Response('Not found', { status: 404 });
        const manifest = JSON.parse(await manifestObject.text());
        const item = (manifest.media || []).find(media => Number(media.photo_id) === Number(exportMediaMatch[2]) && media.variant === exportMediaMatch[3]);
        if (!item) return new Response('Not found', { status: 404 });
        const object = await env.MEDIA.get(item.export_key);
        if (!object) return new Response('Not found', { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('cache-control', 'private, no-store');
        headers.set('content-disposition', 'attachment');
        headers.set('x-content-type-options', 'nosniff');
        return new Response(object.body, { headers });
      }

      const exportDownloadMatch = url.pathname.match(/^\/api\/households\/current\/exports\/([A-Za-z0-9_-]+)\/download$/);
      if (exportDownloadMatch && request.method === 'GET') {
        if (exportRoleDenied) return exportRoleDenied;
        const exportRow = await env.DB.prepare('SELECT * FROM data_exports WHERE id = ? AND household_id = ? LIMIT 1').bind(exportDownloadMatch[1], user.household_id).first();
        if (!exportRow || exportRow.status !== 'completed') return json({ error: 'The export is not ready yet.' }, { status: 409 });
        const manifestObject = await env.MEDIA.get(exportRow.manifest_key);
        if (!manifestObject) return json({ error: 'The export manifest is unavailable.' }, { status: 404 });
        const manifest = JSON.parse(await manifestObject.text());
        return json(publicHouseholdExportManifest(manifest, request.url, user.household_id, exportRow.id));
      }

      const exportStatusMatch = url.pathname.match(/^\/api\/households\/current\/exports\/([A-Za-z0-9_-]+)$/);
      if (exportStatusMatch && request.method === 'GET') {
        if (exportRoleDenied) return exportRoleDenied;
        const exportRow = await env.DB.prepare('SELECT id, status, phase, media_total, media_copied, expires_at, manifest_key, last_error, created_at, updated_at FROM data_exports WHERE id = ? AND household_id = ? LIMIT 1').bind(exportStatusMatch[1], user.household_id).first();
        if (!exportRow) return json({ error: 'Export not found' }, { status: 404 });
        return json({ ...exportRow, media_total: Number(exportRow.media_total || 0), media_copied: Number(exportRow.media_copied || 0), download_url: exportRow.status === 'completed' ? `/api/households/current/exports/${encodeURIComponent(exportRow.id)}/download` : null });
      }

      if (url.pathname === '/api/households/current/deletion' && (request.method === 'POST' || request.method === 'GET')) {
        if (!featureEnabled(env, 'ENABLE_HOUSEHOLD_DELETION', false)) return featureUnavailable('household-deletion');
        if (!['owner', 'admin'].includes(user.role)) return json({ error: 'Only household owners and administrators can request deletion.' }, { status: 403 });
        if (!user.household_id) return json({ error: 'Select a household before requesting deletion.' }, { status: 400 });
        if (request.method === 'GET') {
          const deletion = await env.DB.prepare('SELECT id, status, phase, media_deleted, last_error, created_at, updated_at FROM data_deletions WHERE target_household_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.household_id).first();
          return deletion ? json({ ...deletion, media_deleted: Number(deletion.media_deleted || 0) }) : json({ deletion: null });
        }
        const body = await parseJson(request);
        const householdName = String(user.household_name || '');
        if (!householdName || body?.confirmation !== householdName) return json({ error: 'Type the exact household name to confirm deletion.' }, { status: 400 });
        const idempotency = await claimIdempotency(env, request, user, 'household.delete.create', { householdId: user.household_id, confirmation: householdName });
        if (idempotency?.response) return idempotency.response;
        try {
          const active = await env.DB.prepare("SELECT id, status, phase, media_deleted FROM data_deletions WHERE target_household_id = ? AND status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1").bind(user.household_id).first();
          if (active) {
            const responseBody = { deletion_id: active.id, status: active.status, phase: active.phase, media_deleted: Number(active.media_deleted || 0) };
            await completeIdempotency(env, idempotency, responseBody, 202);
            return json(responseBody, { status: 202, headers: { 'retry-after': '30' } });
          }
          const deletionId = crypto.randomUUID();
          await env.DB.prepare(`INSERT INTO data_deletions (id, household_id, target_household_id, requested_by, status, phase)
            VALUES (?, ?, ?, ?, 'pending', 'preparing')`).bind(deletionId, user.household_id, user.household_id, user.id).run();
          const queued = await enqueueJob(env, { type: 'household_delete', householdId: user.household_id, payload: { deletionId }, idempotencyKey: `household-delete:${deletionId}:0` });
          const responseBody = { deletion_id: deletionId, job_id: queued.id, status: 'pending', phase: 'preparing', media_deleted: 0 };
          await completeIdempotency(env, idempotency, responseBody, 202);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'household.deletion_requested', resourceType: 'data_deletion', resourceId: deletionId }));
          return json(responseBody, { status: 202, headers: { 'retry-after': '30' } });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/admin/operations' && request.method === 'GET') {
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        const countResults = await env.DB.batch([
          env.DB.prepare('SELECT COUNT(*) AS count FROM users'),
          env.DB.prepare('SELECT COUNT(*) AS count FROM households'),
          env.DB.prepare('SELECT COUNT(*) AS count FROM trips'),
          env.DB.prepare('SELECT COUNT(*) AS count FROM photos'),
        ]);
        const latest = await readLatestBackup(env);
        const jobCounts = (await env.DB.prepare('SELECT status, COUNT(*) AS count FROM jobs GROUP BY status').all()).results || [];
        const operationalRows = (await env.DB.prepare(`
          SELECT action, COUNT(*) AS count, MAX(created_at) AS latest_at
          FROM audit_events
          WHERE action IN ('ops.login_failed', 'ops.upload_failed', 'ops.backup_failed', 'ops.worker_error', 'ops.email_failed')
            AND datetime(created_at) > datetime('now', '-24 hours')
          GROUP BY action
        `).all()).results || [];
        const bugRows = (await env.DB.prepare(`
          SELECT id, resource_id, metadata, created_at
          FROM audit_events
          WHERE action = 'bug.reported'
          ORDER BY created_at DESC
          LIMIT 20
        `).all()).results || [];
        const bugReports = bugRows.map(row => {
          const metadata = parseAuditMetadata(row.metadata);
          return {
            id: row.id,
            report_id: row.resource_id,
            created_at: row.created_at,
            ...metadata,
          };
        });
        const operational = Object.fromEntries(operationalRows.map(row => [row.action.replace(/^ops\./, ''), {
          count: Number(row.count || 0),
          latest_at: row.latest_at,
        }]));
        return json({
          checkedAt: new Date().toISOString(),
          database: {
            status: 'connected',
            users: Number(countResults[0].results?.[0]?.count || 0),
            households: Number(countResults[1].results?.[0]?.count || 0),
            trips: Number(countResults[2].results?.[0]?.count || 0),
            photos: Number(countResults[3].results?.[0]?.count || 0),
          },
          backup: backupStatus(latest),
          jobs: Object.fromEntries(jobCounts.map(row => [row.status, Number(row.count || 0)])),
          observability: {
            grafanaUrl: env.GRAFANA_URL || null,
            prometheusUrl: env.PROMETHEUS_URL || null,
            windowHours: 24,
            failures: {
              logins: operational.login_failed || { count: 0, latest_at: null },
              uploads: operational.upload_failed || { count: 0, latest_at: null },
              backups: operational.backup_failed || { count: 0, latest_at: null },
              workerErrors: operational.worker_error || { count: 0, latest_at: null },
              email: operational.email_failed || { count: 0, latest_at: null },
            },
          },
          bugReports,
          email: emailConfiguration(env),
        });
      }

      if (url.pathname === '/api/account/password' && request.method === 'POST') {
        const body = await parseJson(request);
        const problem = passwordProblem(body?.newPassword);
        if (problem) return json({ error: problem }, { status: 400 });
        if (!(await rateLimit(env, 'change-password', requestFingerprint(request, String(user.id)), 8, 30 * 60))) return json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
        const account = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
        if (!account || !(await verifyPassword(body?.currentPassword || '', account.password_hash))) return json({ error: 'Your current password is incorrect.' }, { status: 401 });
        const newHash = await hashPassword(body.newPassword);
        await env.DB.prepare('UPDATE users SET password_hash = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, user.id).run();
        const session = await rotateCurrentSession(env, user, user.household_id, { revokeOthers: true });
        ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'account.password_changed', resourceType: 'user', resourceId: user.id }));
        return json({ success: true, message: 'Password updated. Other sessions were signed out.' }, { headers: { 'set-cookie': sessionCookie(session.token) } });
      }

      if (url.pathname === '/api/account/sessions' && request.method === 'GET') {
        const sessions = (await env.DB.prepare(`
          SELECT token_hash, created_at, last_seen_at, expires_at
          FROM sessions WHERE user_id = ? AND datetime(expires_at) > CURRENT_TIMESTAMP
          ORDER BY last_seen_at DESC, created_at DESC
        `).bind(user.id).all()).results || [];
        return json({ sessions: sessions.map((session, index) => ({
          id: String(index + 1),
          created_at: session.created_at,
          last_seen_at: session.last_seen_at,
          expires_at: session.expires_at,
          current: session.token_hash === user.session_token_hash,
        })) });
      }

      if (url.pathname === '/api/account/sessions/revoke-others' && request.method === 'POST') {
        if (user.session_token_hash) {
          await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, user.session_token_hash).run();
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'account.sessions_revoked', resourceType: 'user', resourceId: user.id, metadata: { scope: 'other_sessions' } }));
          return json({ success: true, message: 'Other sessions were signed out.' });
        }
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
        ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'account.sessions_revoked', resourceType: 'user', resourceId: user.id, metadata: { scope: 'all_sessions' } }));
        return json({ success: true, message: 'All sessions were signed out.' }, { headers: { 'set-cookie': clearSessionCookie() } });
      }

      if (url.pathname === '/api/account/sessions/revoke-all' && request.method === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
        ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'account.sessions_revoked', resourceType: 'user', resourceId: user.id, metadata: { scope: 'all_sessions' } }));
        return json({ success: true, message: 'All sessions were signed out.' }, { headers: { 'set-cookie': clearSessionCookie() } });
      }

      if (url.pathname === '/api/households' && request.method === 'GET') {
        return json({ households: await userHouseholds(env, user.id), active_household_id: user.household_id });
      }

      if (url.pathname === '/api/households' && request.method === 'POST') {
        const body = await parseJson(request);
        const name = String(body?.name || '').trim();
        if (name.length < 2 || name.length > 80) return json({ error: 'Enter a site name between 2 and 80 characters.' }, { status: 400 });
        const idempotency = await claimIdempotency(env, request, user, 'household.create', body);
        if (idempotency?.replayBody?.active_household_id) {
          const session = await rotateCurrentSession(env, user, idempotency.replayBody.active_household_id);
          return json(idempotency.replayBody, { status: idempotency.replayStatus, headers: { 'set-cookie': sessionCookie(session.token), 'idempotent-replay': 'true' } });
        }
        if (idempotency?.response) return idempotency.response;
        const baseSlug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'memories';
        const slug = `${baseSlug}-${randomToken(5).toLowerCase()}`;
        try {
          const created = await env.DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind(slug, name).run();
          const householdId = Number(created.meta.last_row_id);
          await env.DB.prepare("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')").bind(householdId, user.id).run();
          const session = await rotateCurrentSession(env, user, householdId);
          const responseBody = { household: { id: householdId, slug, name, role: 'owner', member_count: 1 }, households: await userHouseholds(env, user.id), active_household_id: householdId };
          await completeIdempotency(env, idempotency, responseBody, 201);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: householdId, action: 'household.created', resourceType: 'household', resourceId: householdId }));
          return json(responseBody, { status: 201, headers: { 'set-cookie': sessionCookie(session.token) } });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/households/switch' && request.method === 'POST') {
        const body = await parseJson(request);
        const householdId = Number(body?.householdId);
        const membership = await env.DB.prepare('SELECT role FROM household_members WHERE user_id = ? AND household_id = ?').bind(user.id, householdId).first();
        if (!membership) return json({ error: 'You do not have access to that memory site.' }, { status: 403 });
        const session = await rotateCurrentSession(env, user, householdId);
        ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: householdId, action: 'household.switched', resourceType: 'household', resourceId: householdId }));
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

      if (url.pathname === '/api/beta/invitations' && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_INVITATIONS')) return featureUnavailable('invitations');
        if (!['owner', 'admin'].includes(user.role)) return json({ error: 'Only site owners can invite beta testers.' }, { status: 403 });
        const body = await parseJson(request);
        const email = normalizeEmail(body?.email);
        const siteName = String(body?.siteName || '').trim();
        if (!validEmail(email)) return json({ error: 'Enter a valid tester email address.' }, { status: 400 });
        if (siteName.length < 2 || siteName.length > 80) return json({ error: 'Enter a site name between 2 and 80 characters.' }, { status: 400 });
        if (!(await rateLimit(env, 'beta-invite', String(user.id), 20, 60 * 60))) return json({ error: 'Too many beta invitations were sent. Please try again later.' }, { status: 429 });
        const idempotency = await claimIdempotency(env, request, user, 'beta.invitation.create', body);
        if (idempotency?.response) return idempotency.response;
        let householdId = null;
        let invitationId = null;
        try {
          const baseSlug = siteName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'memories';
          const slug = `${baseSlug}-${randomToken(5).toLowerCase()}`;
          const created = await env.DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind(slug, siteName).run();
          householdId = Number(created.meta.last_row_id);
          // Keep the inviter attached as an owner for support and a clean
          // rollback path, while the beta tester is also granted owner access
          // when the invitation is accepted.
          await env.DB.prepare("INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')").bind(householdId, user.id).run();
          invitationId = crypto.randomUUID();
          const rawToken = randomToken();
          const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
          await env.DB.prepare(`
            INSERT INTO invitations (id, household_id, email, token_hash, role, invited_by, expires_at)
            VALUES (?, ?, ?, ?, 'owner', ?, ?)
          `).bind(invitationId, householdId, email, await sha256(rawToken), user.id, expiresAt).run();
          try {
            await sendInvitationEmail(env, request, { id: invitationId, email, household_name: siteName, inviter_name: user.display_name || user.email }, rawToken);
          } catch (error) {
            console.error('Beta invitation email failed', error);
            await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();
            await env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(householdId).run();
            await env.DB.prepare('DELETE FROM households WHERE id = ?').bind(householdId).run();
            await releaseIdempotency(env, idempotency);
            return json({ error: 'The beta invitation email could not be sent. Please try again.' }, { status: 503 });
          }
          const responseBody = {
            household: { id: householdId, slug, name: siteName, role: 'owner', member_count: 1 },
            invitation: { id: invitationId, email, role: 'owner', expires_at: expiresAt },
            message: `Beta invitation sent to ${email}.`,
          };
          await completeIdempotency(env, idempotency, responseBody, 201);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId, action: 'beta.invitation_created', resourceType: 'invitation', resourceId: invitationId, metadata: { email, role: 'owner' } }));
          return json(responseBody, { status: 201 });
        } catch (error) {
          if (householdId) {
            await env.DB.prepare('DELETE FROM invitations WHERE household_id = ?').bind(householdId).run();
            await env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(householdId).run();
            await env.DB.prepare('DELETE FROM households WHERE id = ?').bind(householdId).run();
          }
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/households/invitations' && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_INVITATIONS')) return featureUnavailable('invitations');
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
        const idempotency = await claimIdempotency(env, request, user, 'invitation.create', body);
        if (idempotency?.response) return idempotency.response;
        let invitationId;
        try {
          await env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE household_id = ? AND email = ? AND accepted_at IS NULL').bind(user.household_id, email).run();
          invitationId = crypto.randomUUID();
          const rawToken = randomToken();
          const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
          const createdInvitation = await env.DB.prepare(`
            INSERT INTO invitations (id, household_id, email, token_hash, role, invited_by, expires_at)
            SELECT ?, ?, ?, ?, 'member', ?, ?
            WHERE (
              (SELECT COUNT(*) FROM household_members WHERE household_id = ?)
              + (SELECT COUNT(*) FROM invitations WHERE household_id = ? AND accepted_at IS NULL AND datetime(expires_at) > CURRENT_TIMESTAMP)
            ) < 2
            RETURNING id
          `).bind(invitationId, user.household_id, email, await sha256(rawToken), user.id, expiresAt, user.household_id, user.household_id).first();
          if (!createdInvitation) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'This memory site already has its owner and one additional user.' }, { status: 409 });
          }
          const invitation = { id: invitationId, email, household_name: user.household_name, inviter_name: user.display_name || user.email };
          try { await sendInvitationEmail(env, request, invitation, rawToken); }
          catch (error) {
            await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();
            await releaseIdempotency(env, idempotency);
            return json({ error: 'The invitation email could not be sent. Please try again.' }, { status: 503 });
          }
          const responseBody = { invitation: { id: invitationId, email, role: 'member', expires_at: expiresAt }, message: `Invitation sent to ${email}.` };
          await completeIdempotency(env, idempotency, responseBody, 201);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'invitation.created', resourceType: 'invitation', resourceId: invitationId }));
          return json(responseBody, { status: 201 });
        } catch (error) {
          if (invitationId) await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(invitationId).run();
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/households/invitations/accept' && request.method === 'POST') {
        const body = await parseJson(request);
        // Acceptance rotates the active household, so keep this operation's
        // replay scope independent of the pre-acceptance household context.
        const idempotency = await claimIdempotency(env, request, { ...user, household_id: 0 }, 'invitation.accept', body);
        if (idempotency?.response) return idempotency.response;
        const invitation = await invitationByToken(env, body?.token);
        if (!invitation) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'This invitation is invalid or has expired.' }, { status: 400 });
        }
        if (!user.email || user.email !== invitation.email) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'Sign in with the email address that received this invitation.' }, { status: 403 });
        }
        try {
          const existingMembership = await env.DB.prepare('SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ? LIMIT 1').bind(invitation.household_id, user.id).first();
          if (!existingMembership) {
            const membership = await env.DB.prepare(`
              INSERT INTO household_members (household_id, user_id, role)
              SELECT ?, ?, ?
              WHERE (SELECT COUNT(*) FROM household_members WHERE household_id = ?) < 2
              RETURNING household_id
            `).bind(invitation.household_id, user.id, invitation.role, invitation.household_id).first();
            if (!membership) {
              await releaseIdempotency(env, idempotency);
              return json({ error: 'This memory site already has its owner and one additional user.' }, { status: 409 });
            }
          }
          await env.DB.prepare('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = ?').bind(invitation.id).run();
          const responseBody = { success: true, active_household_id: invitation.household_id, households: await userHouseholds(env, user.id) };
          await completeIdempotency(env, idempotency, responseBody, 200);
          const session = await rotateCurrentSession(env, user, invitation.household_id);
          return json(responseBody, { headers: { 'set-cookie': sessionCookie(session.token) } });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/trips' && request.method === 'GET') {
        const conditions = [];
        const values = [];
        if (url.searchParams.get('year')) { conditions.push("substr(t.start_date, 1, 4) = ?"); values.push(url.searchParams.get('year')); }
        if (url.searchParams.get('tripType')) { conditions.push('t.trip_type = ?'); values.push(url.searchParams.get('tripType')); }
        if (url.searchParams.get('travelerId')) {
          conditions.push(`EXISTS (
            SELECT 1 FROM trip_travelers filter_tt
            JOIN travelers filter_tr ON filter_tr.id = filter_tt.traveler_id
              AND filter_tr.household_id = t.household_id
            WHERE filter_tt.trip_id = t.id AND filter_tt.traveler_id = ?
          )`);
          values.push(Number(url.searchParams.get('travelerId')));
        }
        const page = cursorPage(url);
        if (page?.error) return json({ error: page.error }, { status: 400 });
        return json(await decorateTrips(env, user.household_id, conditions.length ? `AND ${conditions.join(' AND ')}` : '', values, {}, page));
      }
      if (url.pathname === '/api/trips' && request.method === 'POST') {
        const body = await parseJson(request);
        const parsed = tripInput(body);
        if (parsed.error) return json({ error: parsed.error }, { status: 400 });
        const input = parsed.value;
        const idempotency = await claimIdempotency(env, request, user, 'trip.create', body);
        if (idempotency?.response) return idempotency.response;
        try {
          const created = await env.DB.prepare(`
            INSERT INTO trips (household_id, location_name, place_name, formatted_address, city, latitude, longitude, country, state, start_date, end_date, date_label, date_precision, trip_type, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(user.household_id, input.locationName, input.placeName, input.formattedAddress, input.city, input.latitude, input.longitude, input.country, input.state, input.startDate, input.endDate, input.dateLabel, input.datePrecision, input.tripType, input.notes, user.id).run();
          const tripId = Number(created.meta.last_row_id);
          const travelerIds = await householdTravelerIds(env, user.household_id, input.travelerIds);
          if (travelerIds.length) await env.DB.batch(travelerIds.map(travelerId => env.DB.prepare('INSERT OR IGNORE INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').bind(tripId, travelerId)));
          const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [tripId]);
          await completeIdempotency(env, idempotency, trips[0], 201);
          return json(trips[0], { status: 201 });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/trips/bulk-delete' && request.method === 'POST') {
        const body = await parseJson(request);
        const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : [])
          .map(Number)
          .filter(id => Number.isInteger(id) && id > 0))];
        if (!ids.length) return json({ error: 'Choose at least one memory to delete' }, { status: 400 });
        if (ids.length > 200) return json({ error: 'Delete no more than 200 memories at once' }, { status: 400 });
        const idempotency = await claimIdempotency(env, request, user, 'trip.bulk-delete', body);
        if (idempotency?.response) return idempotency.response;
        try {
          const placeholders = ids.map(() => '?').join(',');
          const tripsToDelete = (await env.DB.prepare(`SELECT id FROM trips WHERE household_id = ? AND id IN (${placeholders})`).bind(user.household_id, ...ids).all()).results || [];
          const deletedIds = tripsToDelete.map(row => Number(row.id));
          if (deletedIds.length !== ids.length) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'One or more memories were not found' }, { status: 404 });
          }
          if (!deletedIds.length) {
            const responseBody = { deletedIds: [], count: 0 };
            await completeIdempotency(env, idempotency, responseBody, 200);
            return json(responseBody);
          }
          const deletedPlaceholders = deletedIds.map(() => '?').join(',');
          const photoRows = (await env.DB.prepare(`SELECT r2_key, display_r2_key, thumbnail_r2_key FROM photos WHERE household_id = ? AND trip_id IN (${deletedPlaceholders})`).bind(user.household_id, ...deletedIds).all()).results || [];
          const mediaKeys = distinctMediaKeys(photoRows);
          await env.DB.batch([
            env.DB.prepare(`UPDATE journeys SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE household_id = ? AND cover_photo_id IN (SELECT id FROM photos WHERE household_id = ? AND trip_id IN (${deletedPlaceholders}))`).bind(user.household_id, user.household_id, ...deletedIds),
            env.DB.prepare(`DELETE FROM photos WHERE household_id = ? AND trip_id IN (${deletedPlaceholders})`).bind(user.household_id, ...deletedIds),
            env.DB.prepare(`DELETE FROM trip_travelers WHERE trip_id IN (${deletedPlaceholders})`).bind(...deletedIds),
            env.DB.prepare(`DELETE FROM trips WHERE household_id = ? AND id IN (${deletedPlaceholders})`).bind(user.household_id, ...deletedIds),
          ]);
          ctx.waitUntil(deleteMediaKeys(env, mediaKeys).catch(error => console.error('Postcards bulk media cleanup failed', error)));
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'trip.bulk_deleted', resourceType: 'trip', metadata: { count: deletedIds.length } }));
          const responseBody = { deletedIds, count: deletedIds.length, deletedPhotoObjects: mediaKeys.length };
          await completeIdempotency(env, idempotency, responseBody, 200);
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const tripMatch = url.pathname.match(/^\/api\/trips\/(\d+)$/);
      if (tripMatch && request.method === 'GET') {
        const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [Number(tripMatch[1])]);
        return trips.length ? json(trips[0]) : json({ error: 'Trip not found' }, { status: 404 });
      }
      if (tripMatch && request.method === 'DELETE') {
        const tripId = Number(tripMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'trip.delete', { tripId });
        if (idempotency?.response) return idempotency.response;
        const trip = await env.DB.prepare('SELECT id, location_name FROM trips WHERE id = ? AND household_id = ? LIMIT 1').bind(tripId, user.household_id).first();
        if (!trip) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'Trip not found' }, { status: 404 });
        }

        const photoRows = (await env.DB.prepare('SELECT id, r2_key, display_r2_key, thumbnail_r2_key FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id).all()).results || [];
        let mediaKeys;
        try {
          // Reuse the latest scheduled backup when it is fresh. Forcing a
          // complete D1/R2 backup inside a delete request makes the UI wait on
          // the entire media archive and was the source of the slow-delete
          // behavior reported in issue #16.
          await createBackup(env);
          mediaKeys = await tripMediaKeys(env, user.household_id, tripId, photoRows);
        } catch (error) {
          console.error('Pre-delete Postcards backup failed', error);
          await releaseIdempotency(env, idempotency);
          return json({ error: 'The safety backup could not be completed, so this memory was not deleted. Please try again.' }, { status: 503 });
        }

        try {
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
          ctx.waitUntil(createBackup(env).catch(error => console.error('Post-delete Postcards backup failed', error)));
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'trip.deleted', resourceType: 'trip', resourceId: tripId, metadata: { deletedPhotoObjects: mediaKeys.length } }));

          const responseBody = { success: true, deleted: tripId, location_name: trip.location_name, deletedPhotoObjects: mediaKeys.length, mediaCleanupPending };
          await completeIdempotency(env, idempotency, responseBody, 200);
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
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
            UPDATE trips SET location_name = ?, place_name = ?, formatted_address = ?, city = ?, latitude = ?, longitude = ?, country = ?, state = ?, start_date = ?, end_date = ?, date_label = ?, date_precision = ?, trip_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND household_id = ?
          `).bind(input.locationName, input.placeName, input.formattedAddress, input.city, input.latitude, input.longitude, input.country, input.state, input.startDate, input.endDate, input.dateLabel, input.datePrecision, input.tripType, input.notes, tripId, user.household_id),
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

      if (url.pathname === '/api/travelers' && request.method === 'POST') {
        const body = await parseJson(request);
        const name = String(body?.name || '').trim();
        if (!name || name.length > 200) return json({ error: 'Name is required' }, { status: 400 });
        const relationship = String(body?.relationship || 'other').trim().slice(0, 80) || 'other';
        const idempotency = await claimIdempotency(env, request, user, 'traveler.create', body);
        if (idempotency?.response) return idempotency.response;
        try {
          const created = await env.DB.prepare(
            'INSERT INTO travelers (household_id, name, relationship) VALUES (?, ?, ?) RETURNING *',
          ).bind(user.household_id, name, relationship).first();
          const responseBody = { ...created, is_active: Boolean(created?.is_active) };
          await completeIdempotency(env, idempotency, responseBody, 201);
          return json(responseBody, { status: 201 });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const travelerMatch = url.pathname.match(/^\/api\/travelers\/(\d+)$/);
      if (travelerMatch && request.method === 'PUT') {
        const body = await parseJson(request);
        const travelerId = Number(travelerMatch[1]);
        const name = Object.prototype.hasOwnProperty.call(body || {}, 'name') ? String(body?.name || '').trim().slice(0, 200) : null;
        if (Object.prototype.hasOwnProperty.call(body || {}, 'name') && !name) return json({ error: 'Name is required' }, { status: 400 });
        const relationship = Object.prototype.hasOwnProperty.call(body || {}, 'relationship') ? String(body?.relationship || 'other').trim().slice(0, 80) || 'other' : null;
        const isActive = Object.prototype.hasOwnProperty.call(body || {}, 'isActive') ? (body.isActive ? 1 : 0) : null;
        const updated = await env.DB.prepare(`
          UPDATE travelers
          SET name = COALESCE(?, name), relationship = COALESCE(?, relationship), is_active = COALESCE(?, is_active)
          WHERE id = ? AND household_id = ?
          RETURNING *
        `).bind(name, relationship, isActive, travelerId, user.household_id).first();
        return updated
          ? json({ ...updated, is_active: Boolean(updated.is_active) })
          : json({ error: 'Traveler not found' }, { status: 404 });
      }

      if (travelerMatch && request.method === 'DELETE') {
        const travelerId = Number(travelerMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'traveler.delete', { travelerId });
        if (idempotency?.response) return idempotency.response;
        try {
          const result = await env.DB.batch([
            env.DB.prepare('DELETE FROM trip_travelers WHERE traveler_id = ? AND trip_id IN (SELECT id FROM trips WHERE household_id = ?)').bind(travelerId, user.household_id),
            env.DB.prepare('DELETE FROM travelers WHERE id = ? AND household_id = ? RETURNING id').bind(travelerId, user.household_id),
          ]);
          const deleted = result[1]?.results?.[0]?.id;
          if (!deleted) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Traveler not found' }, { status: 404 });
          }
          const responseBody = { message: 'Traveler deleted', id: Number(deleted) };
          await completeIdempotency(env, idempotency, responseBody, 200);
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/journeys' && request.method === 'GET') {
        const page = cursorPage(url, 20);
        if (page?.error) return json({ error: page.error }, { status: 400 });
        return json(await journeys(env, user.household_id, null, null, page));
      }

      if (url.pathname === '/api/journeys' && request.method === 'POST') {
        const body = await parseJson(request);
        const parsed = journeyInput(body);
        if (parsed.error) return json({ error: parsed.error }, { status: 400 });
        const input = parsed.value;
        const idempotency = await claimIdempotency(env, request, user, 'journey.create', body);
        if (idempotency?.response) return idempotency.response;
        try {
          const cover = input.coverPhotoId
            ? await env.DB.prepare('SELECT id FROM photos WHERE id = ? AND household_id = ? LIMIT 1').bind(input.coverPhotoId, user.household_id).first()
            : null;
          if (input.coverPhotoId && !cover) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Cover photo not found' }, { status: 400 });
          }
          const created = await env.DB.prepare(`
            INSERT INTO journeys (household_id, title, start_date, end_date, date_label, journey_type, summary, cover_photo_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `).bind(user.household_id, input.title, input.startDate, input.endDate, input.dateLabel, input.journeyType, input.summary, input.coverPhotoId, user.id).first();
          await assignJourneyMemories(env, user.household_id, created.id, input.memoryIds);
          const full = await journeys(env, user.household_id, null, Number(created.id));
          await completeIdempotency(env, idempotency, full[0], 201);
          return json(full[0], { status: 201 });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const journeyMatch = url.pathname.match(/^\/api\/journeys\/(\d+)$/);
      if (journeyMatch && request.method === 'GET') {
        const result = await journeys(env, user.household_id, null, Number(journeyMatch[1]));
        return result.length ? json(result[0]) : json({ error: 'Journey not found' }, { status: 404 });
      }
      if (journeyMatch && request.method === 'PUT') {
        const journeyId = Number(journeyMatch[1]);
        const existingJourney = await env.DB.prepare('SELECT id FROM journeys WHERE id = ? AND household_id = ? LIMIT 1').bind(journeyId, user.household_id).first();
        if (!existingJourney) return json({ error: 'Journey not found' }, { status: 404 });
        const parsed = journeyInput(await parseJson(request));
        if (parsed.error) return json({ error: parsed.error }, { status: 400 });
        const input = parsed.value;
        const cover = input.coverPhotoId
          ? await env.DB.prepare('SELECT id FROM photos WHERE id = ? AND household_id = ? LIMIT 1').bind(input.coverPhotoId, user.household_id).first()
          : null;
        if (input.coverPhotoId && !cover) return json({ error: 'Cover photo not found' }, { status: 400 });
        const updated = await env.DB.prepare(`
          UPDATE journeys
          SET title = ?, start_date = ?, end_date = ?, date_label = ?, journey_type = ?, summary = ?, cover_photo_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND household_id = ?
          RETURNING id
        `).bind(input.title, input.startDate, input.endDate, input.dateLabel, input.journeyType, input.summary, input.coverPhotoId, journeyId, user.household_id).first();
        if (!updated) return json({ error: 'Journey not found' }, { status: 404 });
        await assignJourneyMemories(env, user.household_id, journeyId, input.memoryIds);
        const full = await journeys(env, user.household_id, null, journeyId);
        return json(full[0]);
      }
      if (journeyMatch && request.method === 'DELETE') {
        const journeyId = Number(journeyMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'journey.delete', { journeyId });
        if (idempotency?.response) return idempotency.response;
        try {
          const result = await env.DB.prepare('DELETE FROM journeys WHERE id = ? AND household_id = ? RETURNING id').bind(journeyId, user.household_id).first();
          if (!result) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Journey not found' }, { status: 404 });
          }
          const responseBody = { success: true, id: Number(result.id) };
          await completeIdempotency(env, idempotency, responseBody, 200);
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const shareMatch = url.pathname.match(/^\/api\/journeys\/(\d+)\/share$/);
      if (shareMatch && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_SHARING')) return featureUnavailable('sharing');
        const journeyId = Number(shareMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'journey.share-create', { journeyId });
        if (idempotency?.response) return idempotency.response;
        try {
          const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
          const result = await env.DB.prepare('UPDATE journeys SET share_token = ?, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?').bind(token, journeyId, user.household_id).run();
          if (!result.meta.changes) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Journey not found' }, { status: 404 });
          }
          const responseBody = { id: journeyId, share_token: token, share_expires_at: null };
          await completeIdempotency(env, idempotency, responseBody, 200);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'journey.share_created', resourceType: 'journey', resourceId: journeyId }));
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }
      if (shareMatch && request.method === 'DELETE') {
        if (!featureEnabled(env, 'ENABLE_SHARING')) return featureUnavailable('sharing');
        const journeyId = Number(shareMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'journey.share-revoke', { journeyId });
        if (idempotency?.response) return idempotency.response;
        try {
          const result = await env.DB.prepare('UPDATE journeys SET share_token = NULL, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?').bind(journeyId, user.household_id).run();
          if (!result.meta.changes) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Journey not found' }, { status: 404 });
          }
          const responseBody = { success: true, id: journeyId };
          await completeIdempotency(env, idempotency, responseBody, 200);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'journey.share_revoked', resourceType: 'journey', resourceId: journeyId }));
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      if (url.pathname === '/api/analytics' && request.method === 'GET') {
        const tripData = await analyticsTripRows(env, user.household_id, env.MAX_ANALYTICS_TRIPS);
        const travelerRows = (await env.DB.prepare('SELECT * FROM travelers WHERE household_id = ?').bind(user.household_id).all()).results || [];
        return json({
          ...analytics(tripData.trips, travelerRows),
          analytics_scope: {
            total_trips: tripData.totalTrips,
            included_trips: tripData.trips.length,
            truncated: tripData.truncated,
          },
        });
      }

      if (url.pathname === '/api/places/search' && request.method === 'GET') {
        if (!featureEnabled(env, 'ENABLE_PLACES')) return featureUnavailable('places');
        const query = normalizePlaceQuery(url.searchParams.get('q'));
        if (query.length < 2) return json({ error: 'Search text is required' }, { status: 400 });
        if (!(await rateLimit(env, 'places', `${user.id}:${query}`, 30, 60))) {
          return json({ error: 'Too many place searches. Please wait a moment and try again.' }, { status: 429 });
        }
        if (!env.GOOGLE_PLACES_API_KEY) return json({ error: 'Google Places search is not configured' }, { status: 503 });
        const ttlMs = Number.parseInt(env.GOOGLE_PLACES_CACHE_TTL_MS || '300000', 10);
        const maxEntries = Number.parseInt(env.GOOGLE_PLACES_CACHE_MAX_ENTRIES || '200', 10);
        const cached = await getPlaceCache(env, query, ttlMs);
        if (cached) return json(cached, { headers: { 'x-places-cache': 'HIT' } });
        try {
          const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': env.GOOGLE_PLACES_API_KEY,
              'x-goog-fieldmask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types',
            },
            body: JSON.stringify({ textQuery: query, pageSize: 5, languageCode: 'en' }),
          });
          if (!response.ok) {
            console.error('Cloudflare Google Places search failed', response.status, (await response.text()).slice(0, 500));
            return json({ error: 'Google Places search failed' }, { status: 502 });
          }
          const data = await response.json();
          const results = (data.places || []).map(googlePlaceResult).filter(result => Number.isFinite(result.lat) && Number.isFinite(result.lng));
          await setPlaceCache(env, query, results, ttlMs, maxEntries);
          return json(results, { headers: { 'x-places-cache': 'MISS' } });
        } catch (error) {
          console.error('Cloudflare Google Places request failed', error);
          return json({ error: 'Google Places search failed' }, { status: 502 });
        }
      }

      if (url.pathname === '/api/places/reverse' && request.method === 'GET') {
        if (!featureEnabled(env, 'ENABLE_LOCATION_LOOKUPS')) return featureUnavailable('location-lookups');
        const latitude = Number(url.searchParams.get('lat'));
        const longitude = Number(url.searchParams.get('lon'));
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          return json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
        }
        if (!(await rateLimit(env, 'places-reverse', `${user.id}:${locationCacheKey(latitude, longitude)}`, 30, 60))) {
          return json({ error: 'Too many location lookups. Please wait a moment.' }, { status: 429 });
        }
        try {
          const location = await reverseGeocodeLocation(env, latitude, longitude);
          return json({
            display_name: location.displayName || location.city || location.state || location.country || 'Photo location',
            displayName: location.displayName,
            city: location.city,
            state: location.state,
            country: location.country,
            address: { city: location.city, state: location.state, country: location.country },
          });
        } catch (error) {
          console.error('Postcards reverse geocode failed', error);
          return json({ error: 'Location lookup failed' }, { status: 502 });
        }
      }

      if (url.pathname === '/api/photos/location-backfill' && request.method === 'GET') {
        if (!featureEnabled(env, 'ENABLE_LOCATION_LOOKUPS')) {
          return json({ count: 0, active_job: null, candidates: [], disabled: true });
        }
        const candidates = await locationBackfillCandidates(env, user.household_id);
        const activeJob = await env.DB.prepare(`
          SELECT id, status, attempts, created_at, updated_at
          FROM jobs
          WHERE household_id = ? AND type = 'location_backfill' AND status IN ('pending', 'running')
          ORDER BY created_at DESC LIMIT 1
        `).bind(user.household_id).first();
        return json({
          count: candidates.length,
          active_job: activeJob ? {
            id: activeJob.id,
            status: activeJob.status,
            attempts: Number(activeJob.attempts || 0),
            created_at: activeJob.created_at,
            updated_at: activeJob.updated_at,
          } : null,
          candidates: candidates.map(candidate => ({
            tripId: candidate.trip_id,
            locationName: candidate.location_name,
            date: candidate.start_date || candidate.date_label || candidate.date_taken,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          })),
        });
      }

      if (url.pathname === '/api/photos/location-backfill' && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_LOCATION_LOOKUPS')) return featureUnavailable('location-lookups');
        if (!featureEnabled(env, 'ENABLE_BACKGROUND_JOBS')) return featureUnavailable('background-jobs');
        if (!(await rateLimit(env, 'location-backfill', String(user.id), 3, 15 * 60))) {
          return json({ error: 'Location lookup is already running or has reached its short-term limit. Please try again later.' }, { status: 429 });
        }
        const activeJob = await env.DB.prepare(`
          SELECT id, status, attempts
          FROM jobs
          WHERE household_id = ? AND type = 'location_backfill' AND status IN ('pending', 'running')
          ORDER BY created_at DESC LIMIT 1
        `).bind(user.household_id).first();
        if (activeJob) {
          return json({
            queued: true,
            job_id: activeJob.id,
            status: activeJob.status,
            attempts: Number(activeJob.attempts || 0),
            message: 'Location backfill is already queued for this household.',
          }, { status: 202, headers: { 'retry-after': '15' } });
        }
        const requestedKey = request.headers.get('idempotency-key');
        const idempotencyKey = requestedKey
          ? `location-backfill:${user.household_id}:${String(requestedKey).slice(0, 180)}`
          : `location-backfill:${user.household_id}:root:${crypto.randomUUID()}`;
        const queued = await enqueueJob(env, {
          type: 'location_backfill',
          householdId: user.household_id,
          payload: { householdId: user.household_id, afterTripId: 0 },
          idempotencyKey,
        });
        return json({
          queued: true,
          job_id: queued.id,
          status: queued.status || 'pending',
          message: queued.created ? 'Location backfill queued. Results will appear after the background runner processes it.' : 'Location backfill request already exists.',
        }, { status: queued.status === 'completed' ? 200 : 202, headers: { 'retry-after': '15' } });
      }

      if (url.pathname === '/api/maintenance/backup-status' && request.method === 'GET') {
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        const latest = await readLatestBackup(env);
        const due = !latest?.lastSuccessfulBackupAt || Date.now() - Date.parse(latest.lastSuccessfulBackupAt) > 24 * 60 * 60 * 1000;
        if (due && featureEnabled(env, 'ENABLE_BACKGROUND_JOBS')) ctx.waitUntil(createBackup(env).catch(error => console.error('Automatic Postcards backup failed', error)));
        return json(backupStatus(latest));
      }

      if (url.pathname === '/api/maintenance/backup-now' && request.method === 'POST') {
        const denied = siteAdminRequired(user);
        if (denied) return denied;
        try {
          const result = backupStatus(await createBackup(env, { force: true }));
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'backup.manual_created', resourceType: 'backup' }));
          return json(result);
        }
        catch (error) {
          console.error('Manual Postcards backup failed', error);
          return json({ error: 'The backup could not be completed. Please try again.' }, { status: 500 });
        }
      }

      if (url.pathname === '/api/photos/quota' && request.method === 'GET') {
        const usage = await env.DB.prepare(`
          SELECT COUNT(*) AS daily_count, COALESCE(SUM(file_size), 0) AS daily_bytes
          FROM photos WHERE household_id = ? AND date(uploaded_at) = date('now')
        `).bind(user.household_id).first();
        const storage = await env.DB.prepare('SELECT COUNT(*) AS photo_count, COALESCE(SUM(file_size), 0) AS storage_bytes FROM photos WHERE household_id = ?').bind(user.household_id).first();
        const storageLimit = Math.max(0, Number(env.MAX_STORAGE_BYTES_PER_HOUSEHOLD || 1024 * 1024 * 1024));
        const storageBytes = Number(storage?.storage_bytes || 0);
        const usagePercent = storageLimit ? Math.min(100, Number((storageBytes / storageLimit * 100).toFixed(1))) : 0;
        const dailyCountLimit = Math.max(0, Number(env.MAX_UPLOADS_PER_DAY || 0));
        const dailyBytesLimit = Math.max(0, Number(env.MAX_UPLOAD_BYTES_PER_DAY || 0));
        return json({
          photo_count: Number(storage?.photo_count || 0),
          storage_bytes: storageBytes,
          storage_limit_bytes: storageLimit,
          storage_usage_percent: usagePercent,
          warning: Boolean(storageLimit && storageBytes / storageLimit >= 0.7),
          blocked: Boolean(storageLimit && storageBytes >= storageLimit),
          daily_upload_count: Number(usage?.daily_count || 0),
          daily_upload_count_limit: dailyCountLimit || null,
          daily_upload_bytes: Number(usage?.daily_bytes || 0),
          daily_upload_bytes_limit: dailyBytesLimit || null,
        });
      }

      if (url.pathname === '/api/photos/upload-sessions' && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_UPLOADS')) return featureUnavailable('uploads');
        const body = await parseJson(request);
        const tripId = Number(body?.tripId);
        const inputFiles = Array.isArray(body?.files) ? body.files : [];
        const maxFilesPerRequest = Math.max(1, Number(env.MAX_UPLOADS_PER_REQUEST || 5));
        if (!Number.isInteger(tripId) || tripId < 1 || !inputFiles.length || inputFiles.length > maxFilesPerRequest) {
          return json({ error: `Provide between one and ${maxFilesPerRequest} upload files for a valid memory.` }, { status: 400 });
        }
        const trip = await env.DB.prepare('SELECT id FROM trips WHERE id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        if (!trip) return json({ error: 'Trip not found' }, { status: 404 });
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
        const maxUploadBytes = Math.max(1, Number(env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024));
        const normalizeVariant = (value, maxBytes) => {
          if (value == null) return null;
          const bytes = Number(value.bytes ?? value.size);
          if (!Number.isInteger(bytes) || bytes < 1 || bytes > maxBytes) return { error: 'Variant size is invalid.' };
          const checksum = value.checksum == null ? null : String(value.checksum);
          if (checksum && !/^[A-Za-z0-9_-]{16,128}$/.test(checksum)) return { error: 'Variant checksum is invalid.' };
          return { bytes, checksum };
        };
        const specs = inputFiles.map(file => {
          const clientUploadId = String(file?.clientUploadId || '');
          const mimeType = String(file?.mimeType || '').toLowerCase();
          const bytes = Number(file?.bytes ?? file?.size);
          const display = normalizeVariant(file?.display, 8 * 1024 * 1024);
          const thumbnail = normalizeVariant(file?.thumbnail, 2 * 1024 * 1024);
          return {
            clientUploadId,
            originalFilename: String(file?.filename || 'photo').replace(/[\\/]/g, '_').slice(0, 255) || 'photo',
            mimeType,
            bytes,
            checksum: file?.checksum == null ? null : String(file.checksum),
            display,
            thumbnail,
          };
        });
        if (specs.some(file => !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(file.clientUploadId)
          || !allowedTypes.has(file.mimeType)
          || !Number.isInteger(file.bytes) || file.bytes < 1 || file.bytes > maxUploadBytes
          || (file.checksum && !/^[A-Za-z0-9_-]{16,128}$/.test(file.checksum))
          || file.display?.error || file.thumbnail?.error)
          || new Set(specs.map(file => file.clientUploadId)).size !== specs.length) {
          return json({ error: 'One or more upload session descriptors are invalid.' }, { status: 400 });
        }
        const idempotencyBody = { tripId, files: specs };
        const idempotency = await claimIdempotency(env, request, user, 'photo.upload-session.create', idempotencyBody);
        if (idempotency?.response) return idempotency.response;
        const clientIds = specs.map(file => file.clientUploadId);
        const placeholders = clientIds.map(() => '?').join(',');
        const existingPhotos = (await env.DB.prepare(`SELECT * FROM photos WHERE household_id = ? AND client_upload_id IN (${placeholders})`).bind(user.household_id, ...clientIds).all()).results || [];
        if (existingPhotos.some(row => Number(row.trip_id) !== tripId)) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'A photo upload identifier is already associated with another memory.' }, { status: 409 });
        }
        const reservationToken = idempotency?.scopeKey || randomToken(18);
        await cleanupExpiredPhotoUploadSessions(env, 100);
        const existingSessions = (await env.DB.prepare(`
          SELECT * FROM photo_upload_sessions
          WHERE household_id = ? AND client_upload_id IN (${placeholders}) AND datetime(expires_at) > CURRENT_TIMESTAMP
        `).bind(user.household_id, ...clientIds).all()).results || [];
        if (existingSessions.some(row => row.reservation_token !== reservationToken || Number(row.trip_id) !== tripId)) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'One or more photos already has an active upload session.' }, { status: 409, headers: { 'retry-after': '5' } });
        }
        const existingPhotoIds = new Set(existingPhotos.map(row => row.client_upload_id));
        const existingSessionIds = new Set(existingSessions.map(row => row.client_upload_id));
        const newSpecs = specs.filter(file => !existingPhotoIds.has(file.clientUploadId) && !existingSessionIds.has(file.clientUploadId));
        const maxStorageBytes = Math.max(0, Number(env.MAX_STORAGE_BYTES_PER_HOUSEHOLD || 1024 * 1024 * 1024));
        const reservation = await reserveUploadSlots(env, {
          householdId: user.household_id,
          tripId,
          reservationToken,
          uploads: newSpecs.map(file => ({ clientUploadId: file.clientUploadId, fileSize: file.bytes, mimeType: file.mimeType })),
          maxStorageBytes,
          maxUploadsPerDay: Math.max(0, Number(env.MAX_UPLOADS_PER_DAY || 0)),
          maxUploadBytesPerDay: Math.max(0, Number(env.MAX_UPLOAD_BYTES_PER_DAY || 0)),
        });
        if (!reservation.ok) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'This household has reached its photo storage or daily upload allowance.' }, { status: 413 });
        }
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const sessionRows = newSpecs.map(file => {
          const sessionId = crypto.randomUUID();
          const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
          const originalKey = uploadMediaKey({ householdId: user.household_id, tripId, variant: 'original', extension: extensionByType[file.mimeType], id: file.clientUploadId });
          return {
            id: sessionId,
            householdId: user.household_id,
            tripId,
            clientUploadId: file.clientUploadId,
            reservationToken,
            originalKey,
            displayKey: file.display ? uploadMediaKey({ householdId: user.household_id, tripId, variant: 'display', extension: 'jpg', id: file.clientUploadId }) : null,
            thumbnailKey: file.thumbnail ? uploadMediaKey({ householdId: user.household_id, tripId, variant: 'thumbnail', extension: 'jpg', id: file.clientUploadId }) : null,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            originalBytes: file.bytes,
            displayBytes: file.display?.bytes ?? null,
            thumbnailBytes: file.thumbnail?.bytes ?? null,
            originalChecksum: file.checksum,
            displayChecksum: file.display?.checksum ?? null,
            thumbnailChecksum: file.thumbnail?.checksum ?? null,
            expiresAt,
          };
        });
        try {
          if (sessionRows.length) await env.DB.batch(sessionRows.map(row => env.DB.prepare(`
            INSERT INTO photo_upload_sessions
              (id, household_id, trip_id, client_upload_id, reservation_token, original_key, display_key, thumbnail_key, original_filename, mime_type, original_bytes, display_bytes, thumbnail_bytes, original_checksum, display_checksum, thumbnail_checksum, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(row.id, row.householdId, row.tripId, row.clientUploadId, row.reservationToken, row.originalKey, row.displayKey, row.thumbnailKey, row.originalFilename, row.mimeType, row.originalBytes, row.displayBytes, row.thumbnailBytes, row.originalChecksum, row.displayChecksum, row.thumbnailChecksum, row.expiresAt)));
          const rows = (await env.DB.prepare(`
            SELECT * FROM photo_upload_sessions
            WHERE household_id = ? AND client_upload_id IN (${placeholders})
            ORDER BY created_at, id
          `).bind(user.household_id, ...clientIds).all()).results || [];
          const sessionByClientId = new Map(rows.map(row => [row.client_upload_id, row]));
          const responseBody = {
            sessions: specs.map(file => existingPhotoIds.has(file.clientUploadId)
              ? { client_upload_id: file.clientUploadId, status: 'complete', photo_id: Number(existingPhotos.find(row => row.client_upload_id === file.clientUploadId).id), photo: photoJson(existingPhotos.find(row => row.client_upload_id === file.clientUploadId)) }
              : uploadSessionJson(sessionByClientId.get(file.clientUploadId) || existingSessions.find(row => row.client_upload_id === file.clientUploadId))),
          };
          await completeIdempotency(env, idempotency, responseBody, 201);
          return json(responseBody, { status: 201 });
        } catch (error) {
          await releaseUploadSlots(env, user.household_id, reservationToken, newSpecs.map(file => file.clientUploadId));
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const uploadSessionVariantMatch = url.pathname.match(/^\/api\/photos\/upload-sessions\/([A-Za-z0-9_-]+)\/(original|display|thumbnail)$/);
      if (uploadSessionVariantMatch && request.method === 'PUT') {
        if (!featureEnabled(env, 'ENABLE_UPLOADS')) return featureUnavailable('uploads');
        const session = await env.DB.prepare('SELECT * FROM photo_upload_sessions WHERE id = ? AND household_id = ? LIMIT 1').bind(uploadSessionVariantMatch[1], user.household_id).first();
        if (!session) return json({ error: 'Upload session not found' }, { status: 404 });
        if (Date.parse(session.expires_at) <= Date.now()) return json({ error: 'Upload session expired. Start the upload again.' }, { status: 410 });
        const variant = uploadSessionVariant(session, uploadSessionVariantMatch[2]);
        if (!variant.key || variant.expectedBytes == null) return json({ error: 'That upload variant was not requested.' }, { status: 400 });
        if (variant.uploadedAt) {
          const existingObject = await env.MEDIA.head(variant.key);
          if (existingObject && Number(existingObject.size) === variant.expectedBytes) return json({ uploaded: true, session_id: session.id, variant: uploadSessionVariantMatch[2], replay: true });
        }
        const bodyBytes = await request.arrayBuffer();
        if (bodyBytes.byteLength !== variant.expectedBytes) return json({ error: 'Uploaded bytes do not match the declared size.' }, { status: 400 });
        const checksum = await sha256Bytes(bodyBytes);
        if (variant.checksum && variant.checksum !== checksum) return json({ error: 'Uploaded bytes failed checksum verification.' }, { status: 400 });
        if (!imageSignatureMatches(bodyBytes, variant.contentType)) return json({ error: 'Uploaded bytes do not contain a supported image signature.' }, { status: 415 });
        await env.MEDIA.put(variant.key, bodyBytes, { httpMetadata: { contentType: variant.contentType }, customMetadata: { sha256: checksum } });
        const timestampColumn = `${uploadSessionVariantMatch[2]}_uploaded_at`;
        const checksumColumn = `${uploadSessionVariantMatch[2]}_checksum`;
        const status = uploadSessionVariantMatch[2] === 'original' ? 'uploaded' : session.status;
        await env.DB.prepare(`UPDATE photo_upload_sessions SET ${timestampColumn} = CURRENT_TIMESTAMP, ${checksumColumn} = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?`).bind(checksum, status, session.id, user.household_id).run();
        return json({ uploaded: true, session_id: session.id, variant: uploadSessionVariantMatch[2], bytes: bodyBytes.byteLength, checksum });
      }

      const uploadSessionFinalizeMatch = url.pathname.match(/^\/api\/photos\/upload-sessions\/([A-Za-z0-9_-]+)\/finalize$/);
      if (uploadSessionFinalizeMatch && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_UPLOADS')) return featureUnavailable('uploads');
        const sessionId = uploadSessionFinalizeMatch[1];
        const body = await parseJson(request);
        const idempotency = await claimIdempotency(env, request, user, 'photo.upload-session.finalize', { sessionId, body });
        if (idempotency?.response) return idempotency.response;
        const session = await env.DB.prepare('SELECT * FROM photo_upload_sessions WHERE id = ? AND household_id = ? LIMIT 1').bind(sessionId, user.household_id).first();
        if (!session) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'Upload session not found' }, { status: 404 });
        }
        if (Date.parse(session.expires_at) <= Date.now()) {
          await releaseIdempotency(env, idempotency);
          return json({ error: 'Upload session expired. Start the upload again.' }, { status: 410 });
        }
        const existingPhoto = await env.DB.prepare('SELECT * FROM photos WHERE household_id = ? AND client_upload_id = ? LIMIT 1').bind(user.household_id, session.client_upload_id).first();
        if (existingPhoto) {
          const responseBody = photoJson(existingPhoto);
          await completeIdempotency(env, idempotency, responseBody, 200);
          return json(responseBody);
        }
        const variants = ['original', 'display', 'thumbnail'].map(name => ({ name, details: uploadSessionVariant(session, name) }));
        for (const { name, details } of variants) {
          if (details.expectedBytes == null) continue;
          const object = await env.MEDIA.head(details.key);
          if (!object || Number(object.size) !== details.expectedBytes) {
            await releaseIdempotency(env, idempotency);
            return json({ error: `The ${name} photo data has not finished uploading.` }, { status: 409, headers: { 'retry-after': '5' } });
          }
        }
        const metadata = uploadSessionMetadata(body);
        const nextOrder = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM photos WHERE trip_id = ? AND household_id = ?').bind(session.trip_id, user.household_id).first();
        const processingStatus = session.display_key && session.thumbnail_key ? 'ready' : 'pending_processing';
        try {
          await env.DB.batch([
            env.DB.prepare(`
              INSERT OR IGNORE INTO photos
                (household_id, trip_id, client_upload_id, r2_key, display_r2_key, thumbnail_r2_key, original_filename, file_size, mime_type, checksum, processing_status, processing_version, metadata_source, date_taken, latitude, longitude, caption, sort_order, is_cover, rotation)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(user.household_id, session.trip_id, session.client_upload_id, session.original_key, session.display_key, session.thumbnail_key, session.original_filename, session.original_bytes, session.mime_type, session.original_checksum, processingStatus, 1, 'client', metadata.dateTaken, metadata.latitude, metadata.longitude, metadata.caption, Number(nextOrder?.next_sort_order || 0), metadata.isCover ? 1 : 0, metadata.rotation),
            env.DB.prepare("UPDATE photo_upload_sessions SET status = 'finalized', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?").bind(session.id, user.household_id),
            env.DB.prepare('DELETE FROM upload_reservations WHERE household_id = ? AND reservation_token = ? AND client_upload_id = ?').bind(user.household_id, session.reservation_token, session.client_upload_id),
          ]);
          const photo = await env.DB.prepare('SELECT * FROM photos WHERE household_id = ? AND client_upload_id = ? LIMIT 1').bind(user.household_id, session.client_upload_id).first();
          const responseBody = photoJson(photo);
          await completeIdempotency(env, idempotency, responseBody, 201);
          return json(responseBody, { status: 201 });
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const photoMatch = url.pathname.match(/^\/api\/photos\/(\d+)$/);
      if (photoMatch && request.method === 'POST') {
        if (!featureEnabled(env, 'ENABLE_UPLOADS')) return featureUnavailable('uploads');
        const tripId = Number(photoMatch[1]);
        const trip = await env.DB.prepare('SELECT id FROM trips WHERE id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        if (!trip) return json({ error: 'Trip not found' }, { status: 404 });

        let formData;
        try { formData = await request.formData(); }
        catch { return json({ error: 'The selected photos could not be read.' }, { status: 400 }); }
        const files = formData.getAll('photos').filter(file => file && typeof file.arrayBuffer === 'function');
        if (!files.length) return json({ error: 'No photos selected' }, { status: 400 });
        const maxFilesPerRequest = Math.max(1, Number(env.MAX_UPLOADS_PER_REQUEST || 5));
        if (files.length > maxFilesPerRequest) return json({ error: `Upload no more than ${maxFilesPerRequest} photos per request.` }, { status: 400 });
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
        const maxUploadBytes = Math.max(1, Number(env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024));
        if (files.some(file => !allowedTypes.has(photoMimeType(file)) || file.size > maxUploadBytes)) return json({ error: `Photos must be JPEG, PNG, GIF, WebP, or HEIC files no larger than ${Math.round(maxUploadBytes / 1024 / 1024)} MB each.` }, { status: 400 });
        const parsedUploadIds = uploadClientIds(formData, files.length);
        if (formData.get('photoUploadIds') != null && !parsedUploadIds) return json({ error: 'Photo upload identifiers are invalid.' }, { status: 400 });
        const clientIds = parsedUploadIds || files.map(() => crypto.randomUUID());
        const reservationToken = uploadAttemptId(formData);
        const uploadIdPlaceholders = clientIds.map(() => '?').join(',');
        const existingRows = (await env.DB.prepare(`SELECT * FROM photos WHERE household_id = ? AND client_upload_id IN (${uploadIdPlaceholders})`).bind(user.household_id, ...clientIds).all()).results || [];
        const existingByClientId = new Map(existingRows.map(row => [row.client_upload_id, row]));
        if (existingRows.some(row => Number(row.trip_id) !== tripId)) return json({ error: 'A photo upload identifier is already associated with another memory.' }, { status: 409 });
        const reservationRows = (await env.DB.prepare(`
          SELECT client_upload_id, trip_id, reservation_token, file_size, mime_type
          FROM upload_reservations
          WHERE household_id = ? AND client_upload_id IN (${uploadIdPlaceholders}) AND datetime(expires_at) > CURRENT_TIMESTAMP
        `).bind(user.household_id, ...clientIds).all()).results || [];
        const reservationByClientId = new Map(reservationRows.map(row => [row.client_upload_id, row]));
        if (reservationRows.some(row => Number(row.trip_id) !== tripId
          || row.reservation_token !== reservationToken
          || Number(row.file_size) !== Number(files[clientIds.indexOf(row.client_upload_id)]?.size || -1)
          || row.mime_type !== photoMimeType(files[clientIds.indexOf(row.client_upload_id)]))) {
          return json({ error: 'One of these photos is already being uploaded. Retry the same upload shortly.' }, { status: 409, headers: { 'retry-after': '5' } });
        }
        const maxStorageBytes = Math.max(0, Number(env.MAX_STORAGE_BYTES_PER_HOUSEHOLD || 1024 * 1024 * 1024));
        const maxUploadsPerDay = Math.max(0, Number(env.MAX_UPLOADS_PER_DAY || 0));
        const maxUploadBytesPerDay = Math.max(0, Number(env.MAX_UPLOAD_BYTES_PER_DAY || 0));

        const metadata = uploadMetadata(formData);
        const displayFiles = formData.getAll('displayPhotos').filter(file => file && typeof file.arrayBuffer === 'function');
        const thumbnailFiles = formData.getAll('thumbnailPhotos').filter(file => file && typeof file.arrayBuffer === 'function');
        if (displayFiles.some(file => photoMimeType(file) !== 'image/jpeg' || file.size > 8 * 1024 * 1024)
          || thumbnailFiles.some(file => photoMimeType(file) !== 'image/jpeg' || file.size > 2 * 1024 * 1024)) {
          return json({ error: 'Generated photo variants are invalid or too large.' }, { status: 400 });
        }
        const displayIndexes = uploadVariantIndexes(formData, 'displayVariantIndexes', files.length);
        const thumbnailIndexes = uploadVariantIndexes(formData, 'thumbnailVariantIndexes', files.length);
        const displayByIndex = new Map(displayIndexes.map((index, variantIndex) => [index, displayFiles[variantIndex]]));
        const thumbnailByIndex = new Map(thumbnailIndexes.map((index, variantIndex) => [index, thumbnailFiles[variantIndex]]));
        const nextOrder = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id).first();
        const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
        const uploads = files.map((file, index) => ({
          clientUploadId: clientIds[index],
          file,
          displayFile: displayByIndex.get(index) || null,
          thumbnailFile: thumbnailByIndex.get(index) || null,
          mimeType: photoMimeType(file),
          fileSize: Number(file.size || 0),
          metadata: metadata[index] || {},
          key: uploadMediaKey({
            householdId: user.household_id,
            tripId,
            variant: 'original',
            extension: extensionByType[photoMimeType(file)],
            id: clientIds[index],
          }),
          sortOrder: Number(nextOrder?.next_sort_order || 0) + index,
          isCover: Number(nextOrder?.next_sort_order || 0) === 0 && index === 0,
        })).filter(upload => !existingByClientId.has(upload.clientUploadId));
        uploads.forEach(upload => {
          upload.id = upload.key.split('/').pop().split('.')[0];
          upload.displayKey = upload.displayFile
            ? uploadMediaKey({ householdId: user.household_id, tripId, variant: 'display', extension: 'jpg', id: upload.id })
            : null;
          upload.thumbnailKey = upload.thumbnailFile
            ? uploadMediaKey({ householdId: user.household_id, tripId, variant: 'thumbnail', extension: 'jpg', id: upload.id })
            : null;
        });

        for (const upload of uploads) {
          upload.originalBytes = await upload.file.arrayBuffer();
          if (!imageSignatureMatches(upload.originalBytes, upload.mimeType)) {
            return json({ error: 'One or more files do not contain a supported image signature.' }, { status: 415 });
          }
          if (upload.displayFile) {
            upload.displayBytes = await upload.displayFile.arrayBuffer();
            if (!imageSignatureMatches(upload.displayBytes, 'image/jpeg')) return json({ error: 'Generated display image data is invalid.' }, { status: 415 });
          }
          if (upload.thumbnailFile) {
            upload.thumbnailBytes = await upload.thumbnailFile.arrayBuffer();
            if (!imageSignatureMatches(upload.thumbnailBytes, 'image/jpeg')) return json({ error: 'Generated thumbnail image data is invalid.' }, { status: 415 });
          }
        }

        const unreservedUploads = uploads.filter(upload => !reservationByClientId.has(upload.clientUploadId));
        const reservation = await reserveUploadSlots(env, {
          householdId: user.household_id,
          tripId,
          uploads: unreservedUploads,
          reservationToken,
          maxStorageBytes,
          maxUploadsPerDay,
          maxUploadBytesPerDay,
        });
        if (!reservation.ok) {
          return json({ error: 'This household has reached its photo storage or daily upload allowance. Please try again later or ask the operator to increase the limit.' }, { status: 413 });
        }

        try {
          for (const upload of uploads) {
            const originalBytes = upload.originalBytes || await upload.file.arrayBuffer();
            if (!imageSignatureMatches(originalBytes, upload.mimeType)) {
              await releaseUploadSlots(env, user.household_id, reservationToken, uploads.map(item => item.clientUploadId));
              return json({ error: 'One or more files do not contain a supported image signature.' }, { status: 415 });
            }
            upload.checksum = await sha256Bytes(originalBytes);
            await env.MEDIA.put(upload.key, originalBytes, { httpMetadata: { contentType: upload.mimeType }, customMetadata: { sha256: upload.checksum } });
            if (upload.displayFile) {
              const displayBytes = upload.displayBytes || await upload.displayFile.arrayBuffer();
              if (!imageSignatureMatches(displayBytes, 'image/jpeg')) {
                await releaseUploadSlots(env, user.household_id, reservationToken, uploads.map(item => item.clientUploadId));
                return json({ error: 'Generated display image data is invalid.' }, { status: 415 });
              }
              upload.displayChecksum = await sha256Bytes(displayBytes);
              await env.MEDIA.put(upload.displayKey, displayBytes, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { sha256: upload.displayChecksum } });
            }
            if (upload.thumbnailFile) {
              const thumbnailBytes = upload.thumbnailBytes || await upload.thumbnailFile.arrayBuffer();
              if (!imageSignatureMatches(thumbnailBytes, 'image/jpeg')) {
                await releaseUploadSlots(env, user.household_id, reservationToken, uploads.map(item => item.clientUploadId));
                return json({ error: 'Generated thumbnail image data is invalid.' }, { status: 415 });
              }
              upload.thumbnailChecksum = await sha256Bytes(thumbnailBytes);
              await env.MEDIA.put(upload.thumbnailKey, thumbnailBytes, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { sha256: upload.thumbnailChecksum } });
            }
          }
          if (uploads.length) await env.DB.batch(uploads.map(upload => env.DB.prepare(`
            INSERT INTO photos (household_id, trip_id, client_upload_id, r2_key, display_r2_key, thumbnail_r2_key, original_filename, file_size, mime_type, checksum, processing_status, processing_version, metadata_source, date_taken, latitude, longitude, sort_order, is_cover)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(user.household_id, tripId, upload.clientUploadId, upload.key, upload.displayKey, upload.thumbnailKey, String(upload.file.name || 'photo').slice(0, 255), upload.file.size, upload.mimeType, upload.checksum, upload.displayFile && upload.thumbnailFile ? 'ready' : 'pending_processing', 1, 'client', upload.metadata.dateTaken || null, upload.metadata.latitude ?? null, upload.metadata.longitude ?? null, upload.sortOrder, upload.isCover ? 1 : 0)));
          const persistedRows = uploads.length
            ? ((await env.DB.prepare(`SELECT * FROM photos WHERE household_id = ? AND client_upload_id IN (${uploadIdPlaceholders})`).bind(user.household_id, ...clientIds).all()).results || [])
            : [];
          const rowsByClientId = new Map([...existingRows, ...persistedRows].map(row => [row.client_upload_id, row]));
          const rows = clientIds.map(clientId => rowsByClientId.get(clientId)).filter(Boolean);
          await releaseUploadSlots(env, user.household_id, reservationToken, uploads.map(upload => upload.clientUploadId));
          return json({ count: rows.length, photos: rows.map(photoJson) }, { status: 201 });
        } catch (error) {
          await releaseUploadSlots(env, user.household_id, reservationToken, uploads.map(upload => upload.clientUploadId)).catch(() => null);
          await deleteMediaKeys(env, distinctMediaKeys(uploads.map(upload => ({
            r2_key: upload.key,
            display_r2_key: upload.displayKey,
            thumbnail_r2_key: upload.thumbnailKey,
          })))).catch(() => null);
          console.error('Postcards photo upload failed', error);
          return json({ error: 'The photos could not be saved. Please try again.' }, { status: 500 });
        }
      }
      if (photoMatch && request.method === 'GET') {
        const page = cursorPage(url, 100);
        if (page?.error) return json({ error: page.error }, { status: 400 });
        const pageCondition = [];
        const pageValues = [];
        if (page?.cursor) {
          const cover = Number(page.cursor.cover);
          const sortOrder = Number(page.cursor.sortOrder);
          const id = Number(page.cursor.id);
          if (![0, 1].includes(cover) || !Number.isInteger(sortOrder) || !Number.isInteger(id)) {
            return json({ error: 'Invalid page cursor' }, { status: 400 });
          }
          pageCondition.push('(p.is_cover < ? OR (p.is_cover = ? AND (p.sort_order > ? OR (p.sort_order = ? AND p.id > ?))))');
          pageValues.push(cover, cover, sortOrder, sortOrder, id);
        }
        const rows = (await env.DB.prepare(`
          SELECT p.* FROM photos p JOIN trips t ON t.id = p.trip_id
          WHERE p.trip_id = ? AND p.household_id = ? AND t.household_id = ?
            ${pageCondition.length ? `AND ${pageCondition.join(' AND ')}` : ''}
          ORDER BY p.is_cover DESC, p.sort_order, p.id
          ${page ? 'LIMIT ?' : ''}
        `).bind(Number(photoMatch[1]), user.household_id, user.household_id, ...pageValues, ...(page ? [page.limit + 1] : [])).all()).results || [];
        if (!page) return json(rows.map(photoJson));
        const hasMore = rows.length > page.limit;
        const items = rows.slice(0, page.limit).map(photoJson);
        const last = rows[page.limit - 1];
        return json({
          photos: items,
          next_cursor: hasMore ? encodePageCursor({ cover: Number(last.is_cover || 0), sortOrder: Number(last.sort_order || 0), id: Number(last.id) }) : null,
        });
      }

      const photoIdMatch = url.pathname.match(/^\/api\/photos\/(\d+)$/);
      if (photoIdMatch && request.method === 'PATCH') {
        const photoId = Number(photoIdMatch[1]);
        const existing = await env.DB.prepare('SELECT * FROM photos WHERE id = ? AND household_id = ? LIMIT 1').bind(photoId, user.household_id).first();
        if (!existing) return json({ error: 'Photo not found' }, { status: 404 });
        const body = await parseJson(request);
        const caption = Object.prototype.hasOwnProperty.call(body || {}, 'caption')
          ? String(body?.caption || '').trim().slice(0, 2000) || null
          : existing.caption;
        const requestedRotation = Object.prototype.hasOwnProperty.call(body || {}, 'rotation') ? Number(body.rotation) : Number(existing.rotation || 0);
        const rotation = [0, 90, 180, 270].includes(requestedRotation) ? requestedRotation : 0;
        const isCover = Object.prototype.hasOwnProperty.call(body || {}, 'isCover') ? (body.isCover ? 1 : 0) : Number(existing.is_cover || 0);
        const statements = [];
        if (isCover) statements.push(env.DB.prepare('UPDATE photos SET is_cover = 0 WHERE trip_id = ? AND household_id = ?').bind(existing.trip_id, user.household_id));
        statements.push(env.DB.prepare(`
          UPDATE photos SET caption = ?, rotation = ?, is_cover = ?
          WHERE id = ? AND household_id = ?
          RETURNING *
        `).bind(caption, rotation, isCover, photoId, user.household_id));
        const results = await env.DB.batch(statements);
        const updated = results[results.length - 1]?.results?.[0];
        return updated ? json(photoJson(updated)) : json({ error: 'Photo not found' }, { status: 404 });
      }

      if (photoIdMatch && request.method === 'DELETE') {
        const photoId = Number(photoIdMatch[1]);
        const idempotency = await claimIdempotency(env, request, user, 'photo.delete', { photoId });
        if (idempotency?.response) return idempotency.response;
        try {
          const existing = await env.DB.prepare('SELECT id, r2_key, display_r2_key, thumbnail_r2_key FROM photos WHERE id = ? AND household_id = ? LIMIT 1').bind(photoId, user.household_id).first();
          if (!existing) {
            await releaseIdempotency(env, idempotency);
            return json({ error: 'Photo not found' }, { status: 404 });
          }
          await env.DB.prepare('DELETE FROM photos WHERE id = ? AND household_id = ?').bind(photoId, user.household_id).run();
          const mediaKeys = distinctMediaKeys([existing]);
          ctx.waitUntil((async () => {
            try {
              await enqueueJob(env, {
                type: 'media_delete',
                householdId: user.household_id,
                payload: { keys: mediaKeys },
                idempotencyKey: `photo-delete:${photoId}:${existing.r2_key}`,
              });
              await drainJobs(env, 1);
            } catch (error) {
              console.error(`Postcards photo cleanup job failed for ${photoId}`, error);
              await deleteMediaKeys(env, mediaKeys).catch(cleanupError => console.error(`Postcards photo cleanup failed for ${photoId}`, cleanupError));
            }
          })());
          const responseBody = { success: true, message: 'Photo deleted', id: photoId };
          await completeIdempotency(env, idempotency, responseBody, 200);
          ctx.waitUntil(recordAudit(env, { userId: user.id, householdId: user.household_id, action: 'photo.deleted', resourceType: 'photo', resourceId: photoId, metadata: { mediaObjects: mediaKeys.length } }));
          return json(responseBody);
        } catch (error) {
          await releaseIdempotency(env, idempotency);
          throw error;
        }
      }

      const reorderMatch = url.pathname.match(/^\/api\/photos\/(\d+)\/reorder$/);
      if (reorderMatch && request.method === 'PUT') {
        const tripId = Number(reorderMatch[1]);
        const existingTrip = await env.DB.prepare('SELECT id FROM trips WHERE id = ? AND household_id = ? LIMIT 1').bind(tripId, user.household_id).first();
        if (!existingTrip) return json({ error: 'Trip not found' }, { status: 404 });
        const body = await parseJson(request);
        const photoIds = Array.isArray(body?.photoIds)
          ? [...new Set(body.photoIds.map(Number).filter(id => Number.isInteger(id) && id > 0))]
          : [];
        const existingRows = (await env.DB.prepare('SELECT id FROM photos WHERE trip_id = ? AND household_id = ?').bind(tripId, user.household_id).all()).results || [];
        const existingIds = existingRows.map(row => Number(row.id)).sort((a, b) => a - b);
        const requestedIds = [...photoIds].sort((a, b) => a - b);
        if (existingIds.length !== requestedIds.length || existingIds.some((id, index) => id !== requestedIds[index])) {
          return json({ error: 'Photo order must include every saved photo exactly once' }, { status: 400 });
        }
        await env.DB.batch(photoIds.map((photoId, index) => env.DB.prepare('UPDATE photos SET sort_order = ? WHERE id = ? AND trip_id = ? AND household_id = ?').bind(index, photoId, tripId, user.household_id)));
        const rows = (await env.DB.prepare('SELECT * FROM photos WHERE trip_id = ? AND household_id = ? ORDER BY is_cover DESC, sort_order, date_taken, uploaded_at, id').bind(tripId, user.household_id).all()).results || [];
        return json(rows.map(photoJson));
      }

      return json({ error: 'Not found' }, { status: 404 });
    }

    const response = withAssetCacheHeaders(await env.ASSETS.fetch(request), url.pathname);
    if (response.status !== 404 || request.method !== 'GET') return response;

    return withAssetCacheHeaders(await env.ASSETS.fetch(new Request(new URL('/index.html', url), request)), '/index.html');
}

function requestIdFor(request) {
  const supplied = request.headers.get('x-request-id') || '';
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function withSecurityHeaders(response, request, requestId) {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('x-permitted-cross-domain-policies', 'none');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('permissions-policy', 'camera=(self), geolocation=(self), microphone=()');
  headers.set('content-security-policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org https://places.googleapis.com",
    "form-action 'self'",
  ].join('; '));
  if (new URL(request.url).protocol === 'https:') headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function withAssetCacheHeaders(response, pathname) {
  if (response.status < 200 || response.status >= 300) return response;
  const headers = new Headers(response.headers);
  if (pathname.startsWith('/assets/')) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  } else if (pathname === '/index.html' || pathname === '/') {
    headers.set('cache-control', 'public, max-age=60, must-revalidate');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const requestId = requestIdFor(request);
    try {
      const response = withSecurityHeaders(await handleFetch(request, env, ctx), request, requestId);
      const path = new URL(request.url).pathname;
      if (response.status >= 500) {
        ctx.waitUntil(recordOperationalEvent(env, { action: 'worker_error', requestId, route: path, status: response.status }));
      } else if (path === '/api/auth/login' && response.status >= 400) {
        ctx.waitUntil(recordOperationalEvent(env, { action: 'login_failed', requestId, route: path, status: response.status }));
      } else if ((path === '/api/photos' || path.startsWith('/api/photos/upload-sessions')) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && response.status >= 400) {
        ctx.waitUntil(recordOperationalEvent(env, { action: 'upload_failed', requestId, route: path, status: response.status }));
      } else if (path.startsWith('/api/maintenance/backup') && response.status >= 400) {
        ctx.waitUntil(recordOperationalEvent(env, { action: 'backup_failed', requestId, route: path, status: response.status }));
      }
      return response;
    } catch (error) {
      console.error('Postcards unhandled request failure', { requestId, path: new URL(request.url).pathname, error: String(error?.message || error) });
      ctx.waitUntil(recordOperationalEvent(env, { action: 'worker_error', requestId, route: new URL(request.url).pathname, status: 500 }));
      return withSecurityHeaders(json({ error: 'The request could not be completed.' }, { status: 500 }), request, requestId);
    }
  },

  async scheduled(controller, env, ctx) {
    if (!featureEnabled(env, 'ENABLE_BACKGROUND_JOBS')) return;
    ctx.waitUntil(drainJobs(env, 5).catch(async error => { console.error('Postcards scheduled jobs failed', error); await recordOperationalEvent(env, { action: 'worker_error', route: 'scheduled:jobs', status: 500 }); }));
    ctx.waitUntil(cleanupOperationalRows(env).catch(async error => { console.error('Postcards operational cleanup failed', error); await recordOperationalEvent(env, { action: 'worker_error', route: 'scheduled:cleanup', status: 500 }); }));
    ctx.waitUntil(cleanupExpiredPhotoUploadSessions(env).catch(async error => { console.error('Postcards upload-session cleanup failed', error); await recordOperationalEvent(env, { action: 'worker_error', route: 'scheduled:photo-cleanup', status: 500 }); }));
    ctx.waitUntil(cleanupExpiredDataExports(env).catch(async error => { console.error('Postcards export cleanup failed', error); await recordOperationalEvent(env, { action: 'worker_error', route: 'scheduled:export-cleanup', status: 500 }); }));
    if (featureEnabled(env, 'ENABLE_AUTOMATIC_BACKUPS')) {
      ctx.waitUntil(createBackup(env).catch(async error => { console.error('Postcards scheduled backup failed', error); await recordOperationalEvent(env, { action: 'backup_failed', route: 'scheduled:backup', status: 500 }); }));
    }
  },
};
