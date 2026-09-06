import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';
import { buildTravelDistanceSummary } from '../src/utils/travelDistance.js';

function context() {
  return { waitUntil() {} };
}

function request(url, options = {}) {
  return new Request(`https://postcards.test${url}`, {
    ...options,
    headers: {
      origin: 'https://postcards.test',
      ...(options.headers || {}),
    },
  });
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie');
  assert.ok(value, 'expected a session cookie');
  return value.split(';', 1)[0];
}

async function fixture() {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name, site_admin) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 1)').bind('owner', 'yancmo@gmail.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('first', 'First family'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('second', 'Second family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (2, 1, ?)').bind('member'),
    DB.prepare('INSERT INTO travelers (household_id, name, relationship) VALUES (1, ?, ?)').bind('First traveler', 'spouse'),
    DB.prepare('INSERT INTO travelers (household_id, name, relationship) VALUES (2, ?, ?)').bind('Second traveler', 'spouse'),
    DB.prepare('INSERT INTO journeys (household_id, title, created_by) VALUES (1, ?, 1)').bind('First journey'),
    DB.prepare('INSERT INTO journeys (household_id, title, created_by) VALUES (2, ?, 1)').bind('Second journey'),
    DB.prepare('INSERT INTO trips (household_id, location_name, journey_id, created_by) VALUES (1, ?, 1, 1)').bind('First trip'),
    DB.prepare('INSERT INTO trips (household_id, location_name, journey_id, created_by) VALUES (2, ?, 2, 1)').bind('Second trip'),
    DB.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (1, 1)').bind(),
    DB.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (2, 2)').bind(),
    DB.prepare('INSERT INTO photos (household_id, trip_id, r2_key, original_filename, file_size, mime_type) VALUES (1, 1, ?, ?, ?, ?)').bind('households/1/trips/1/original/first.jpg', 'first.jpg', 11, 'image/jpeg'),
    DB.prepare('INSERT INTO photos (household_id, trip_id, r2_key, original_filename, file_size, mime_type) VALUES (2, 2, ?, ?, ?, ?)').bind('households/2/trips/2/original/second.jpg', 'second.jpg', 12, 'image/jpeg'),
  ]);
  await MEDIA.put('households/1/trips/1/original/first.jpg', new TextEncoder().encode('first-photo'), { httpMetadata: { contentType: 'image/jpeg' } });
  await MEDIA.put('households/2/trips/2/original/second.jpg', new TextEncoder().encode('second-photo'), { httpMetadata: { contentType: 'image/jpeg' } });
  const env = { DB, MEDIA };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'yancmo@gmail.com', password: 'correct horse battery staple' }),
  }), env, context());
  assert.equal(login.status, 200);
  return { DB, MEDIA, env, cookie: cookieFrom(login) };
}

test('authenticated route contract returns bounded shapes and security headers', async () => {
  const { DB, env, cookie } = await fixture();
  const routes = [
    ['/api/auth/me', 'GET', 200],
    ['/api/households', 'GET', 200],
    ['/api/households/current/members', 'GET', 200],
    ['/api/travelers', 'GET', 200],
    ['/api/journeys?paginate=true&limit=1', 'GET', 200],
    ['/api/trips?paginate=true&limit=1', 'GET', 200],
    ['/api/photos/1?paginate=true&limit=1', 'GET', 200],
    ['/api/photos/quota', 'GET', 200],
    ['/api/analytics', 'GET', 200],
    ['/api/households/current/exports', 'GET', 200],
    ['/api/households/current/deletion', 'GET', 503],
    ['/api/maintenance/backup-status', 'GET', 200],
    ['/api/admin/operations', 'GET', 200],
  ];

  for (const [path, method, expectedStatus] of routes) {
    const response = await worker.fetch(request(path, { method, headers: { cookie } }), env, context());
    assert.equal(response.status, expectedStatus, `${method} ${path}`);
    assert.ok(response.headers.get('x-request-id'), `${method} ${path} request id`);
    assert.equal(response.headers.get('x-frame-options'), 'DENY', `${method} ${path} frame policy`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${method} ${path} content sniff policy`);
    const body = await response.json();
    assert.ok(body !== null && typeof body === 'object', `${method} ${path} JSON body`);
    if (path === '/api/analytics') {
      assert.equal(body.analytics_scope.total_trips, 1);
      assert.equal(body.analytics_scope.included_trips, 1);
      assert.equal(body.analytics_scope.truncated, false);
      assert.equal(body.distance.estimateMethod, 'round_trip');
      assert.equal(body.distance.mappedMemories, 0);
      assert.equal(body.distance.unmappedMemories, 1);
    }
    if (path === '/api/admin/operations') {
      assert.deepEqual(body.email, { provider: 'resend', sender_configured: false, delivery_configured: false });
      assert.equal(body.sites.length, 2);
      assert.equal(body.database.storage_bytes, 23);
      assert.equal(body.sites[0].storage_bytes, 11);
      assert.equal(body.sites[0].photo_count, 1);
      assert.equal(body.sites[0].active_30d, true);
      assert.equal(Object.hasOwn(body.sites[0], 'email'), false);
    }
  }

  const methodRejected = await worker.fetch(request('/api/trips/1', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  }), env, context());
  assert.equal(methodRejected.status, 404);
  assert.equal((await methodRejected.json()).error, 'Not found');
  DB.close();
});

test('onboarding progress is persisted per user and home completion is server-derived', async () => {
  const { DB, env, cookie } = await fixture();
  const initial = await worker.fetch(request('/api/onboarding', { headers: { cookie } }), env, context());
  assert.equal(initial.status, 200);
  const initialBody = await initial.json();
  assert.equal(initialBody.home.complete, false);
  assert.equal(initialBody.people.complete, true);
  assert.equal(initialBody.welcomeSeen, false);

  const skipped = await worker.fetch(request('/api/onboarding', {
    method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ step: 'home', status: 'skipped' }),
  }), env, context());
  assert.equal(skipped.status, 200);

  const saved = await worker.fetch(request('/api/auth/me', {
    method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ homeLatitude: 35.4676, homeLongitude: -97.5164, homeLabel: 'Oklahoma City', homeIcon: 'h' }),
  }), env, context());
  assert.equal(saved.status, 200);

  const resumed = await worker.fetch(request('/api/onboarding', { headers: { cookie } }), env, context());
  const resumedBody = await resumed.json();
  assert.equal(resumedBody.home.complete, true);
  assert.equal(resumedBody.home.skipped, false);
  DB.close();
});

test('admin site deletion requires the exact name and queues a retryable deletion job', async () => {
  const { DB, env, cookie } = await fixture();

  const rejected = await worker.fetch(request('/api/admin/households/2/deletion', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'wrong name' }),
  }), env, context());
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /exact site name/i);

  const queued = await worker.fetch(request('/api/admin/households/2/deletion', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirmation: 'Second family' }),
  }), env, context());
  assert.equal(queued.status, 202);
  const queuedBody = await queued.json();
  assert.equal(queuedBody.status, 'pending');
  assert.equal(queuedBody.phase, 'preparing');

  const status = await worker.fetch(request('/api/admin/households/2/deletion', { headers: { cookie } }), env, context());
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, 'pending');
  DB.close();
});

test('Operations access is reserved for yancmo@gmail.com', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name, site_admin) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 1)').bind('legacy-admin', 'legacy-admin@example.com', passwordHash, 'Legacy Admin'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('legacy-family', 'Legacy family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'legacy-admin@example.com', password: 'correct horse battery staple' }),
  }), { DB, MEDIA }, context());
  assert.equal(login.status, 200);
  assert.equal((await login.clone().json()).user.site_admin, false);

  const operations = await worker.fetch(request('/api/admin/operations', {
    headers: { cookie: cookieFrom(login) },
  }), { DB, MEDIA }, context());
  assert.equal(operations.status, 403);
  DB.close();
});

test('analytics counts standalone round trips and journey routes from home', async () => {
  const { DB, env, cookie } = await fixture();
  await DB.batch([
    DB.prepare('UPDATE users SET home_latitude = ?, home_longitude = ? WHERE id = 1').bind(0, 0),
    DB.prepare('UPDATE trips SET latitude = ?, longitude = ?, start_date = ?, journey_id = ?, journey_order = ? WHERE id = 1').bind(0, 1, '2024-06-01', 1, 1),
    DB.prepare('INSERT INTO trips (household_id, location_name, latitude, longitude, start_date, journey_id, journey_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(1, 'Journey stop 2', 0, 2, '2024-06-02', 1, 2, 1),
    DB.prepare('INSERT INTO trips (household_id, location_name, latitude, longitude, start_date, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(1, 'Standalone stop', 0, 3, '2025-06-01', 1),
  ]);

  const rows = (await DB.prepare('SELECT id, latitude, longitude, start_date, journey_id, journey_order FROM trips WHERE household_id = 1 ORDER BY id').all()).results;
  const expected = buildTravelDistanceSummary(rows, { latitude: 0, longitude: 0 });
  const response = await worker.fetch(request('/api/analytics', { headers: { cookie } }), env, context());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.distance.totalMiles, Math.round(expected.totalMiles));
  assert.equal(body.distance.mappedMemories, 3);
  assert.equal(body.distance.unmappedMemories, 0);
  assert.equal(body.distance.estimateMethod, 'round_trip');
  DB.close();
});

test('numeric IDs and bulk writes cannot cross a household boundary', async () => {
  const { DB, MEDIA, env, cookie } = await fixture();
  const hiddenRoutes = [
    ['/api/trips/2', 'GET'],
    ['/api/trips/2', 'PUT'],
    ['/api/trips/2', 'DELETE'],
    ['/api/journeys/2', 'GET'],
    ['/api/journeys/2', 'PUT'],
    ['/api/journeys/2', 'DELETE'],
    ['/api/travelers/2', 'PUT'],
    ['/api/travelers/2', 'DELETE'],
    ['/api/photos/2', 'GET'],
    ['/api/photos/2', 'PATCH'],
    ['/api/photos/2', 'DELETE'],
    ['/api/photos/2/reorder', 'PUT'],
    ['/photos/households/2/trips/2/original/second.jpg', 'GET'],
  ];

  for (const [path, method] of hiddenRoutes) {
    const options = { method, headers: { cookie } };
    if (method === 'PUT' || method === 'PATCH') {
      options.headers['content-type'] = 'application/json';
      options.body = path.includes('/reorder')
        ? JSON.stringify({ photoIds: [] })
        : JSON.stringify({ caption: 'attempted cross-household write' });
    }
    const response = await worker.fetch(request(path, options), env, context());
    if (path === '/api/photos/2' && method === 'GET') {
      assert.equal(response.status, 200, `${method} ${path} is a trip-scoped empty list`);
      assert.deepEqual(await response.json(), [], 'cross-household trip photo list is empty');
    } else {
      assert.equal(response.status, 404, `${method} ${path} must not disclose the other household`);
    }
  }

  const mixedDelete = await worker.fetch(request('/api/trips/bulk-delete', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'mixed-household-delete' },
    body: JSON.stringify({ ids: [1, 2] }),
  }), env, context());
  assert.equal(mixedDelete.status, 404);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM trips').first()).count), 2);

  const media = await MEDIA.get('households/2/trips/2/original/second.jpg');
  assert.ok(media, 'cross-household media remains present');
  DB.close();
});
