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

test('authenticated users can submit bug reports and admins can review them', async () => {
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
  let report;
  try {
    const waiting = [];
    const form = new FormData();
    form.set('title', 'Could not save a memory');
    form.set('details', 'The save button returned an error after I entered a location.');
    form.set('context', JSON.stringify({ requestId: 'request-123', page: '/memories', appVersion: 'test' }));
    form.set('screenshot', new File([new Uint8Array([137, 80, 78, 71])], 'memory-error.png', { type: 'image/png' }));
    report = await worker.fetch(request('/api/feedback/bugs', {
      method: 'POST',
      headers: { cookie },
      body: form,
    }), { DB, MEDIA, EMAIL_FROM: 'Postcards of Us <postcards@mail.postcardsofus.com>', RESEND_API_KEY: 'test-key', BUG_REPORT_TO: 'bugs@postcardsofus.com' }, context(waiting));
    assert.equal(report.status, 201);
    await Promise.all(waiting);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(emailRequests.length, 1);
  assert.deepEqual(emailRequests[0].to, ['bugs@postcardsofus.com']);
  assert.match(emailRequests[0].subject, /Could not save a memory/);
  assert.equal(emailRequests[0].attachments.length, 1);
  assert.equal(emailRequests[0].attachments[0].filename, 'memory-error.png');
  const reportBody = await report.clone().json();

  const stored = await DB.prepare("SELECT action, resource_type, metadata FROM audit_events WHERE action = 'bug.reported'").first();
  assert.equal(stored.resource_type, 'bug_report');
  const metadata = JSON.parse(stored.metadata);
  assert.equal(metadata.requestId, 'request-123');
  assert.equal(metadata.screenshot.filename, 'memory-error.png');
  assert.ok(await MEDIA.head(metadata.screenshot.key));

  const operations = await worker.fetch(request('/api/admin/operations', { headers: { cookie } }), { DB, MEDIA }, context());
  assert.equal(operations.status, 200);
  assert.equal((await operations.json()).bugReports.length, 1);

  const screenshot = await worker.fetch(request(`/api/admin/bug-reports/${reportBody.id}/screenshot`, { headers: { cookie } }), { DB, MEDIA }, context());
  assert.equal(screenshot.status, 200);
  assert.equal(screenshot.headers.get('content-type'), 'image/png');
  assert.deepEqual(new Uint8Array(await screenshot.arrayBuffer()), new Uint8Array([137, 80, 78, 71]));

  const githubRequests = [];
  const githubFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    githubRequests.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
    if (String(url).endsWith('/issues')) return new Response(JSON.stringify({ id: 456, number: 27, html_url: 'https://github.com/yancmo1/travel-journal/issues/27' }), { status: 201 });
    return githubFetch(url, options);
  };
  try {
    const pushed = await worker.fetch(request(`/api/admin/bug-reports/${reportBody.id}/github-issue`, { method: 'POST', headers: { cookie } }), { DB, MEDIA, GITHUB_TOKEN: 'test-token', GITHUB_REPOSITORY: 'yancmo1/travel-journal' }, context());
    assert.equal(pushed.status, 201);
    assert.equal((await pushed.json()).githubIssue.number, 27);
    const replay = await worker.fetch(request(`/api/admin/bug-reports/${reportBody.id}/github-issue`, { method: 'POST', headers: { cookie } }), { DB, MEDIA, GITHUB_TOKEN: 'test-token', GITHUB_REPOSITORY: 'yancmo1/travel-journal' }, context());
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).githubIssue.url, 'https://github.com/yancmo1/travel-journal/issues/27');
  } finally {
    globalThis.fetch = githubFetch;
  }
  assert.equal(githubRequests.length, 1);
  assert.deepEqual(githubRequests[0].body.labels, ['Bug Report']);

  const deleted = await worker.fetch(request(`/api/admin/bug-reports/${reportBody.id}`, { method: 'DELETE', headers: { cookie } }), { DB, MEDIA }, context());
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted, reportBody.id);
  assert.equal(await MEDIA.head(metadata.screenshot.key), null);
  const emptyOperations = await worker.fetch(request('/api/admin/operations', { headers: { cookie } }), { DB, MEDIA }, context());
  assert.equal((await emptyOperations.json()).bugReports.length, 0);
  DB.close();
});
