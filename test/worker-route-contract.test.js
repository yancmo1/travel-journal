import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

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
    }
    if (path === '/api/admin/operations') {
      assert.deepEqual(body.email, { provider: 'resend', sender_configured: false, delivery_configured: false });
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
