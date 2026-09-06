import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

function context(waiting = []) {
  return { waitUntil(promise) { waiting.push(promise); } };
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

test('authenticated users can submit first-memory feedback and admins can review it', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name, site_admin) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 1)').bind('owner', 'yancmo@gmail.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);

  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'yancmo@gmail.com', password: 'correct horse battery staple' }),
  }), { DB, MEDIA }, context());
  const cookie = cookieFrom(login);

  const emailRequests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    emailRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const waiting = [];
    const response = await worker.fetch(request('/api/feedback/beta', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ response: 'I was not sure where to start' }),
    }), { DB, MEDIA, EMAIL_FROM: 'Postcards of Us <postcards@mail.postcardsofus.com>', RESEND_API_KEY: 'test-key', SIGNUP_NOTIFICATION_TO: 'yancmo@gmail.com' }, context(waiting));
    assert.equal(response.status, 201);
    await Promise.all(waiting);
    assert.equal(emailRequests.length, 1);
    assert.deepEqual(emailRequests[0].to, ['yancmo@gmail.com']);
    assert.match(emailRequests[0].subject, /Beta feedback/);
    assert.match(emailRequests[0].text, /I was not sure where to start/);

    const stored = await DB.prepare("SELECT action, resource_type, metadata FROM audit_events WHERE action = 'beta.feedback.submitted'").first();
    assert.equal(stored.resource_type, 'beta_feedback');
    assert.equal(JSON.parse(stored.metadata).response, 'I was not sure where to start');

    const operations = await worker.fetch(request('/api/admin/operations', { headers: { cookie } }), { DB, MEDIA }, context());
    assert.equal(operations.status, 200);
    const body = await operations.json();
    assert.equal(body.betaFeedback.length, 1);
    assert.equal(body.betaFeedback[0].response, 'I was not sure where to start');
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('first-memory feedback only accepts the provided answers', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple' }),
  }), { DB, MEDIA }, context());

  const response = await worker.fetch(request('/api/feedback/beta', {
    method: 'POST',
    headers: { cookie: cookieFrom(login), 'content-type': 'application/json' },
    body: JSON.stringify({ response: 'A made-up answer' }),
  }), { DB, MEDIA }, context());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Choose one of the available answers.');
  DB.close();
});
