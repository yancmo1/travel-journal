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
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('authenticated users can submit bug reports and admins can review them', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name, site_admin) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 1)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);

  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple' }),
  }), { DB, MEDIA }, context());
  const cookie = cookieFrom(login);

  const report = await worker.fetch(request('/api/feedback/bugs', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Could not save a memory',
      details: 'The save button returned an error after I entered a location.',
      context: { requestId: 'request-123', page: '/memories', appVersion: 'test' },
    }),
  }), { DB, MEDIA }, context());
  assert.equal(report.status, 201);

  const stored = await DB.prepare("SELECT action, resource_type, metadata FROM audit_events WHERE action = 'bug.reported'").first();
  assert.equal(stored.resource_type, 'bug_report');
  assert.equal(JSON.parse(stored.metadata).requestId, 'request-123');

  const operations = await worker.fetch(request('/api/admin/operations', { headers: { cookie } }), { DB, MEDIA }, context());
  assert.equal(operations.status, 200);
  assert.equal((await operations.json()).bugReports.length, 1);
  DB.close();
});
