import bcrypt from 'bcryptjs';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };
const encoder = new TextEncoder();

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

async function authenticate(request, env) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || !env.JWT_SECRET) return null;
  try {
    const claims = await verifyToken(authorization.slice(7), env.JWT_SECRET);
    const user = await env.DB.prepare(`
      SELECT u.id, u.username, u.display_name, hm.household_id
      FROM users u JOIN household_members hm ON hm.user_id = u.id
      WHERE u.id = ? LIMIT 1
    `).bind(claims.id).first();
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
    statement = env.DB.prepare(`SELECT * FROM journeys WHERE share_token = ? AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP) LIMIT 1`).bind(publicToken);
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
  async fetch(request, env) {
    const url = new URL(request.url);

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

    if (url.pathname.startsWith('/photos/') && request.method === 'GET') {
      const key = decodeURIComponent(url.pathname.slice('/photos/'.length));
      if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
      const object = await env.MEDIA.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=86400');
      return new Response(object.body, { headers });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await parseJson(request);
      if (!body?.username || !body?.password) return json({ error: 'Username and password required' }, { status: 400 });
      const user = await env.DB.prepare('SELECT id, username, password_hash, display_name FROM users WHERE username = ?').bind(body.username).first();
      if (!user || !(await bcrypt.compare(body.password, user.password_hash))) return json({ error: 'Invalid credentials' }, { status: 401 });
      const publicUser = { id: user.id, username: user.username, display_name: user.display_name };
      return json({ user: publicUser, token: await createToken(publicUser, env.JWT_SECRET) });
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') return json({ error: 'Postcards of Us is currently invitation-only.' }, { status: 403 });

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

      if (url.pathname === '/api/auth/me' && request.method === 'GET') return json({ user: { id: user.id, username: user.username, display_name: user.display_name } });

      if (url.pathname === '/api/trips' && request.method === 'GET') {
        const conditions = [];
        const values = [];
        if (url.searchParams.get('year')) { conditions.push("substr(t.start_date, 1, 4) = ?"); values.push(url.searchParams.get('year')); }
        if (url.searchParams.get('tripType')) { conditions.push('t.trip_type = ?'); values.push(url.searchParams.get('tripType')); }
        if (url.searchParams.get('travelerId')) { conditions.push('EXISTS (SELECT 1 FROM trip_travelers filter_tt WHERE filter_tt.trip_id = t.id AND filter_tt.traveler_id = ?)'); values.push(Number(url.searchParams.get('travelerId'))); }
        return json(await decorateTrips(env, user.household_id, conditions.length ? `AND ${conditions.join(' AND ')}` : '', values));
      }

      const tripMatch = url.pathname.match(/^\/api\/trips\/(\d+)$/);
      if (tripMatch && request.method === 'GET') {
        const trips = await decorateTrips(env, user.household_id, 'AND t.id = ?', [Number(tripMatch[1])]);
        return trips.length ? json(trips[0]) : json({ error: 'Trip not found' }, { status: 404 });
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
        return json({ configured: false, stale: true, staleAfterHours: 30, lastSuccessfulBackupAt: env.LEGACY_BACKUP_AT || null, lastDatabaseDumpAt: env.LEGACY_BACKUP_AT || null, databaseDumpBytes: Number(env.LEGACY_DATABASE_DUMP_BYTES || 0), photoStorageBytes: Number(env.LEGACY_PHOTO_BYTES || 0), checkedAt: new Date().toISOString(), message: 'The migration snapshot is verified. Automated Cloudflare backups still need to be scheduled.' });
      }

      const photoMatch = url.pathname.match(/^\/api\/photos\/(\d+)$/);
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
