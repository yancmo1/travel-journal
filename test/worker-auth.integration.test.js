import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import worker from '../worker/sites-static.js';
import { createD1Database } from './helpers/d1.js';
import { MemoryR2 } from './helpers/r2.js';

function context() {
  return { waitUntil() {} };
}

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function request(url, options = {}) {
  return new Request(`https://postcardsofus.test${url}`, {
    ...options,
    headers: {
      origin: 'https://postcardsofus.test',
      ...(options.headers || {}),
    },
  });
}

async function tokenHash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Buffer.from(bytes).toString('base64url');
}

function jpegBytes(label) {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode(label), 0xff, 0xd9]);
}

test('legacy username accounts can claim the email used for beta sign-in', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)').bind('yancmo', passwordHash, 'Yancy'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('legacy-family', 'Legacy Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, ?)').bind(1, 1, 'owner'),
  ]);
  const response = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'yancmo@gmail.com', password: 'correct horse battery staple' }),
  }), { DB, MEDIA }, context());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.email, 'yancmo@gmail.com');
  assert.equal((await DB.prepare('SELECT email FROM users WHERE id = 1').first()).email, 'yancmo@gmail.com');
  DB.close();
});

test('invited account creation replays safely after a client retry', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  const rawToken = 'invitation-retry-token';
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO invitations (id, household_id, email, token_hash, role, invited_by, expires_at) VALUES (?, 1, ?, ?, ?, 1, datetime(\'now\', \'+1 day\'))').bind('invite-1', 'new@example.com', await tokenHash(rawToken), 'member'),
  ]);
  const env = { DB, MEDIA };
  const options = {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'invite-account-retry-1' },
    body: JSON.stringify({ token: rawToken, displayName: 'New Member', password: 'another secure phrase' }),
  };
  const first = await worker.fetch(request('/api/auth/register-invite', options), env, context());
  assert.equal(first.status, 201);
  const replay = await worker.fetch(request('/api/auth/register-invite', options), env, context());
  assert.equal(replay.status, 201);
  assert.equal(replay.headers.get('idempotent-replay'), 'true');
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM users').first()).count), 2);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM household_members').first()).count), 2);
  DB.close();
});

test('beta tester invitations create an isolated owner site', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const env = { DB, MEDIA, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple' }),
  }), env, context());
  const cookie = cookieFrom(login);
  const originalFetch = globalThis.fetch;
  const emailRequests = [];
  globalThis.fetch = async (_url, options) => {
    emailRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `email-${emailRequests.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const invite = await worker.fetch(request('/api/beta/invitations', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'beta-invite-1' },
      body: JSON.stringify({ email: 'tester@example.com', siteName: 'Tester Family' }),
    }), env, context());
    assert.equal(invite.status, 201);
    assert.equal(emailRequests.length, 1);
    assert.match(emailRequests[0].subject, /Tester Family/);
    const invitationLink = new URL(emailRequests[0].text.match(/https?:\/\/\S+/)[0]);
    const rawToken = invitationLink.searchParams.get('invite');
    assert.ok(rawToken);
    assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM households').first()).count), 2);
    assert.equal((await DB.prepare('SELECT role FROM invitations WHERE email = ?').bind('tester@example.com').first()).role, 'owner');

    const registration = await worker.fetch(request('/api/auth/register-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'beta-register-1' },
      body: JSON.stringify({ token: rawToken, displayName: 'Beta Tester', password: 'another secure phrase' }),
    }), env, context());
    assert.equal(registration.status, 201);
    assert.equal((await DB.prepare('SELECT role FROM household_members WHERE user_id = 2 AND household_id = 2').first()).role, 'owner');
    assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM household_members WHERE household_id = 1').first()).count), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('memory sites allow only one additional family member', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const env = { DB, MEDIA, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple' }),
  }), env, context());
  const cookie = cookieFrom(login);
  const originalFetch = globalThis.fetch;
  let invitationLink;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    invitationLink = body.text.match(/https?:\/\/\S+/)[0];
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const invitation = await worker.fetch(request('/api/households/invitations', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'family-invite-1' },
      body: JSON.stringify({ email: 'family@example.com' }),
    }), env, context());
    assert.equal(invitation.status, 201);

    const registration = await worker.fetch(request('/api/auth/register-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'family-register-1' },
      body: JSON.stringify({ token: new URL(invitationLink).searchParams.get('invite'), displayName: 'Family Member', password: 'another secure phrase' }),
    }), env, context());
    assert.equal(registration.status, 201);

    const blocked = await worker.fetch(request('/api/households/invitations', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'family-invite-2' },
      body: JSON.stringify({ email: 'third-person@example.com' }),
    }), env, context());
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /one additional user/i);
    assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM household_members WHERE household_id = 1').first()).count), 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('password recovery uses a generic response, rotates sessions, and consumes the token', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('old secure password', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('recovery-owner', 'recovery@example.com', passwordHash, 'Recovery Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('recovery-family', 'Recovery Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const env = { DB, MEDIA, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'recovery@example.com', password: 'old secure password' }),
  }), env, context());
  assert.equal(login.status, 200);
  const oldCookie = cookieFrom(login);

  const originalFetch = globalThis.fetch;
  const emailRequests = [];
  globalThis.fetch = async (_url, options) => {
    emailRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `email-${emailRequests.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const pending = [];
  const asyncContext = { waitUntil(promise) { pending.push(promise); } };
  try {
    const forgot = await worker.fetch(request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'recovery@example.com' }),
    }), env, asyncContext);
    assert.equal(forgot.status, 200);
    assert.deepEqual(await forgot.json(), { message: 'If an account uses that email, a reset link is on its way.' });
    await Promise.all(pending);
    assert.equal(emailRequests.length, 1);
    const resetLink = new URL(emailRequests[0].text.match(/https?:\/\/\S+/)[0]);
    const rawToken = resetLink.searchParams.get('reset');
    assert.ok(rawToken);

    const reset = await worker.fetch(request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'new family phrase' }),
    }), env, asyncContext);
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).success, true);
    assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM password_reset_tokens WHERE used_at IS NOT NULL').first()).count), 1);
    assert.equal(emailRequests.length, 2);

    const stale = await worker.fetch(request('/api/auth/me', { headers: { cookie: oldCookie } }), env, context());
    assert.equal(stale.status, 401);
    const newLogin = await worker.fetch(request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'recovery@example.com', password: 'new family phrase' }),
    }), env, context());
    assert.equal(newLogin.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('password recovery can bootstrap an unverified imported email', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('old secure password', 4);
  await DB.prepare('INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)').bind('imported-owner', 'imported@example.com', passwordHash, 'Imported Owner').run();
  const env = { DB, MEDIA, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' };
  const originalFetch = globalThis.fetch;
  const emailRequests = [];
  const pending = [];
  globalThis.fetch = async (_url, options) => {
    emailRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `email-${emailRequests.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const forgot = await worker.fetch(request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'imported@example.com' }),
    }), env, { waitUntil(promise) { pending.push(promise); } });
    assert.equal(forgot.status, 200);
    await Promise.all(pending);
    assert.equal(emailRequests.length, 1);
    const resetLink = new URL(emailRequests[0].text.match(/https?:\/\/\S+/)[0]);
    const rawToken = resetLink.searchParams.get('reset');
    assert.ok(rawToken);

    const reset = await worker.fetch(request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: rawToken, password: 'new family phrase' }),
    }), env, { waitUntil() {} });
    assert.equal(reset.status, 200);
    assert.ok((await DB.prepare('SELECT email_verified_at FROM users WHERE id = 1').first()).email_verified_at);
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('email verification can be resent and consumed once', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)').bind('unverified', 'unverified@example.com', passwordHash, 'Unverified User'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('verification-family', 'Verification Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const env = { DB, MEDIA, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' };
  const originalFetch = globalThis.fetch;
  const emailRequests = [];
  const pending = [];
  globalThis.fetch = async (_url, options) => {
    emailRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: `email-${emailRequests.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const login = await worker.fetch(request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'unverified@example.com', password: 'correct horse battery staple' }),
    }), env, context());
    const cookie = cookieFrom(login);
    const resend = await worker.fetch(request('/api/auth/resend-verification', {
      method: 'POST', headers: { cookie },
    }), env, { waitUntil(promise) { pending.push(promise); } });
    assert.equal(resend.status, 200);
    await Promise.all(pending);
    assert.equal(emailRequests.length, 1);
    const verificationLink = new URL(emailRequests[0].text.match(/https?:\/\/\S+/)[0]);
    const rawToken = verificationLink.searchParams.get('verify');
    assert.ok(rawToken);
    const verified = await worker.fetch(request('/api/auth/verify-email', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: rawToken }),
    }), env, context());
    assert.equal(verified.status, 200);
    assert.ok((await DB.prepare('SELECT email_verified_at FROM users WHERE id = 1').first()).email_verified_at);
    const replay = await worker.fetch(request('/api/auth/verify-email', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: rawToken }),
    }), env, context());
    assert.equal(replay.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
  DB.close();
});

test('admin operations exposes recent failed-login monitoring counters', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name, site_admin) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, 1)').bind('monitor-owner', 'yancmo@gmail.com', passwordHash, 'Monitor Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('monitor-family', 'Monitor Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
  ]);
  const env = { DB, MEDIA };
  const pending = [];
  const failedLogin = await worker.fetch(request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'yancmo@gmail.com', password: 'wrong password' }),
  }), env, { waitUntil(promise) { pending.push(promise); } });
  assert.equal(failedLogin.status, 401);
  await Promise.all(pending);
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'yancmo@gmail.com', password: 'correct horse battery staple' }),
  }), env, context());
  const operations = await worker.fetch(request('/api/admin/operations', { headers: { cookie: cookieFrom(login) } }), env, context());
  const body = await operations.json();
  assert.ok(body.observability.failures.logins.count >= 1);
  assert.equal(body.observability.windowHours, 24);
  DB.close();
});

test('invitation acceptance replays safely after session rotation', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  const rawToken = 'accept-retry-token';
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('member', 'member@example.com', passwordHash, 'Member'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('family', 'Family'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO invitations (id, household_id, email, token_hash, role, invited_by, expires_at) VALUES (?, 1, ?, ?, ?, 1, datetime(\'now\', \'+1 day\'))').bind('accept-1', 'member@example.com', await tokenHash(rawToken), 'member'),
  ]);
  const env = { DB, MEDIA };
  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'member@example.com', password: 'correct horse battery staple' }),
  }), env, context());
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const options = {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'accept-retry-1' },
    body: JSON.stringify({ token: rawToken }),
  };
  const accepted = await worker.fetch(request('/api/households/invitations/accept', options), env, context());
  assert.equal(accepted.status, 200);
  const replay = await worker.fetch(request('/api/households/invitations/accept', {
    ...options,
    headers: { ...options.headers, cookie: cookieFrom(accepted) },
  }), env, context());
  assert.equal(replay.status, 200);
  assert.equal(replay.headers.get('idempotent-replay'), 'true');
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM household_members WHERE household_id = 1 AND user_id = 2').first()).count), 1);
  DB.close();
});

test('cookie session rotation invalidates the prior household context', async () => {
  const DB = createD1Database();
  const MEDIA = new MemoryR2();
  const passwordHash = bcrypt.hashSync('correct horse battery staple', 4);
  await DB.batch([
    DB.prepare('INSERT INTO users (username, email, email_verified_at, password_hash, display_name) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)').bind('owner', 'owner@example.com', passwordHash, 'Owner'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('first', 'First'),
    DB.prepare('INSERT INTO households (slug, name) VALUES (?, ?)').bind('second', 'Second'),
  ]);
  await DB.batch([
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (1, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO household_members (household_id, user_id, role) VALUES (2, 1, ?)').bind('owner'),
    DB.prepare('INSERT INTO travelers (household_id, name, relationship) VALUES (1, ?, ?)').bind('First traveler', 'spouse'),
    DB.prepare('INSERT INTO travelers (household_id, name, relationship) VALUES (2, ?, ?)').bind('Second traveler', 'spouse'),
    DB.prepare('INSERT INTO trips (household_id, location_name, created_by) VALUES (1, ?, 1)').bind('First trip'),
    DB.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (1, 2)'),
    DB.prepare('INSERT INTO journeys (household_id, title, start_date, end_date, created_by) VALUES (1, ?, ?, ?, 1)').bind('First journey', '2026-07-10', '2026-07-20'),
    DB.prepare('INSERT INTO photos (household_id, trip_id, r2_key, original_filename, file_size, mime_type) VALUES (1, 1, ?, ?, ?, ?)').bind('households/1/trips/1/original/photo.jpg', 'photo.jpg', 12, 'image/jpeg'),
  ]);
  await MEDIA.put('households/1/trips/1/original/photo.jpg', new TextEncoder().encode('private-photo'), { httpMetadata: { contentType: 'image/jpeg' } });
  const env = { DB, MEDIA };

  const login = await worker.fetch(request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'correct horse battery staple' }),
  }), env, context());
  assert.equal(login.status, 200);
  const oldCookie = cookieFrom(login);

  const crossHouseholdFilter = await worker.fetch(request('/api/trips?travelerId=2', { headers: { cookie: oldCookie } }), env, context());
  assert.equal(crossHouseholdFilter.status, 200);
  assert.deepEqual(await crossHouseholdFilter.json(), []);

  const ownedMedia = await worker.fetch(request('/photos/households/1/trips/1/original/photo.jpg', { headers: { cookie: oldCookie } }), env, context());
  assert.equal(ownedMedia.status, 200);

  const uploadForm = () => {
    const form = new FormData();
    form.append('photos', new File([jpegBytes('uploaded-photo')], 'uploaded.jpg', { type: 'image/jpeg' }));
    form.append('photoUploadIds', JSON.stringify(['upload-retry-1']));
    form.append('uploadAttemptId', 'upload-attempt-1');
    form.append('photoMetadata', JSON.stringify([{}]));
    return form;
  };
  const uploaded = await worker.fetch(request('/api/photos/1', { method: 'POST', headers: { cookie: oldCookie }, body: uploadForm() }), env, context());
  assert.equal(uploaded.status, 201);
  assert.equal((await uploaded.json()).count, 1);
  const uploadedPhoto = await DB.prepare('SELECT checksum FROM photos WHERE client_upload_id = ?').bind('upload-retry-1').first();
  assert.match(String(uploadedPhoto.checksum), /^[A-Za-z0-9_-]{43}$/);
  const uploadedObject = await MEDIA.head('households/1/trips/1/original/upload-retry-1.jpg');
  assert.equal(uploadedObject.customMetadata.sha256, uploadedPhoto.checksum);
  const uploadedRetry = await worker.fetch(request('/api/photos/1', { method: 'POST', headers: { cookie: oldCookie }, body: uploadForm() }), env, context());
  assert.equal(uploadedRetry.status, 201);
  assert.equal((await uploadedRetry.json()).count, 1);
  assert.equal(Number((await DB.prepare('SELECT COUNT(*) AS count FROM photos WHERE client_upload_id = ?').bind('upload-retry-1').first()).count), 1);

  const sessionOriginalBytes = jpegBytes('session-photo');
  const sessionDisplayBytes = jpegBytes('session-display');
  const sessionThumbnailBytes = jpegBytes('session-thumb');
  const sessionBody = JSON.stringify({
    tripId: 1,
    files: [{
      clientUploadId: 'session-upload-1',
      filename: 'session.jpg',
      mimeType: 'image/jpeg',
      bytes: sessionOriginalBytes.byteLength,
      display: { bytes: sessionDisplayBytes.byteLength },
      thumbnail: { bytes: sessionThumbnailBytes.byteLength },
    }],
  });
  const sessionRequest = {
    method: 'POST',
    headers: { cookie: oldCookie, 'content-type': 'application/json', 'idempotency-key': 'session-create-retry-1' },
    body: sessionBody,
  };
  const createdSession = await worker.fetch(request('/api/photos/upload-sessions', sessionRequest), env, context());
  assert.equal(createdSession.status, 201);
  const session = (await createdSession.json()).sessions[0];
  assert.equal(session.status, 'pending');
  const replayedSession = await worker.fetch(request('/api/photos/upload-sessions', sessionRequest), env, context());
  assert.equal(replayedSession.status, 201);
  assert.equal(replayedSession.headers.get('idempotent-replay'), 'true');
  assert.equal((await replayedSession.json()).sessions[0].id, session.id);
  const uploadSessionBytes = async (url, bytes, contentType) => worker.fetch(request(url, {
    method: 'PUT',
    headers: { cookie: oldCookie, 'content-type': contentType },
    body: bytes,
  }), env, context());
  assert.equal((await uploadSessionBytes(session.original.upload_url, sessionOriginalBytes, 'image/jpeg')).status, 200);
  assert.equal((await uploadSessionBytes(session.display.upload_url, sessionDisplayBytes, 'image/jpeg')).status, 200);
  assert.equal((await uploadSessionBytes(session.thumbnail.upload_url, sessionThumbnailBytes, 'image/jpeg')).status, 200);
  const finalizeOptions = {
    method: 'POST',
    headers: { cookie: oldCookie, 'content-type': 'application/json', 'idempotency-key': 'session-finalize-retry-1' },
    body: JSON.stringify({ sessionId: session.id, metadata: { caption: 'Session upload' } }),
  };
  const finalizedSession = await worker.fetch(request(`/api/photos/upload-sessions/${session.id}/finalize`, finalizeOptions), env, context());
  assert.equal(finalizedSession.status, 201);
  const finalizedPhoto = await finalizedSession.json();
  assert.equal(finalizedPhoto.processing_status, 'ready');
  const finalizedPhotoRow = await DB.prepare('SELECT checksum, r2_key FROM photos WHERE client_upload_id = ?').bind('session-upload-1').first();
  assert.match(String(finalizedPhotoRow.checksum), /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await MEDIA.head(finalizedPhotoRow.r2_key)).customMetadata.sha256, finalizedPhotoRow.checksum);
  const replayedFinalize = await worker.fetch(request(`/api/photos/upload-sessions/${session.id}/finalize`, finalizeOptions), env, context());
  assert.equal(replayedFinalize.status, 201);
  assert.equal(replayedFinalize.headers.get('idempotent-replay'), 'true');

  const createTripOptions = {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: oldCookie, 'idempotency-key': 'trip-create-retry-1' },
    body: JSON.stringify({
      locationName: 'Idempotent Place',
      placeName: 'Idempotent Museum',
      formattedAddress: '123 Example St, Oklahoma City, OK, United States',
      tripType: 'Road Trip',
    }),
  };
  const firstTrip = await worker.fetch(request('/api/trips', createTripOptions), env, context());
  assert.equal(firstTrip.status, 201);
  const firstTripBody = await firstTrip.json();
  assert.equal(firstTripBody.place_name, 'Idempotent Museum');
  assert.equal(firstTripBody.formatted_address, '123 Example St, Oklahoma City, OK, United States');
  const storedTrip = await DB.prepare('SELECT place_name, formatted_address FROM trips WHERE id = ?').bind(firstTripBody.id).first();
  assert.equal(storedTrip.place_name, 'Idempotent Museum');
  assert.equal(storedTrip.formatted_address, '123 Example St, Oklahoma City, OK, United States');
  const journeyMatchForm = new FormData();
  journeyMatchForm.append('photos', new File([jpegBytes('journey-match-photo')], 'journey-match.jpg', { type: 'image/jpeg' }));
  journeyMatchForm.append('photoUploadIds', JSON.stringify(['journey-match-upload-1']));
  journeyMatchForm.append('uploadAttemptId', 'journey-match-attempt-1');
  journeyMatchForm.append('photoMetadata', JSON.stringify([{ dateTaken: '2026-07-15T12:00:00.000Z' }]));
  const journeyMatchUpload = await worker.fetch(request('/api/photos/2', { method: 'POST', headers: { cookie: oldCookie }, body: journeyMatchForm }), env, context());
  assert.equal(journeyMatchUpload.status, 201);
  const journeyMatch = await DB.prepare('SELECT journey_id, journey_order FROM trips WHERE id = 2').first();
  assert.equal(journeyMatch.journey_id, 1);
  assert.equal(journeyMatch.journey_order, 1);
  const replayTrip = await worker.fetch(request('/api/trips', createTripOptions), env, context());
  assert.equal(replayTrip.status, 201);
  assert.equal(replayTrip.headers.get('idempotent-replay'), 'true');
  assert.equal((await replayTrip.json()).id, firstTripBody.id);
  const conflictTrip = await worker.fetch(request('/api/trips', {
    ...createTripOptions,
    body: JSON.stringify({ locationName: 'Different Place', tripType: 'Road Trip' }),
  }), env, context());
  assert.equal(conflictTrip.status, 409);

  const disabledBackfill = await worker.fetch(request('/api/photos/location-backfill', { headers: { cookie: oldCookie } }), { ...env, ENABLE_LOCATION_LOOKUPS: 'false' }, context());
  assert.equal(disabledBackfill.status, 200);
  assert.equal((await disabledBackfill.json()).disabled, true);

  await MEDIA.put('_backups/latest.json', new TextEncoder().encode(JSON.stringify({
    lastSuccessfulBackupAt: new Date().toISOString(),
  })));

  const deleteTripOptions = {
    method: 'DELETE',
    headers: { cookie: oldCookie, 'idempotency-key': 'trip-delete-retry-1' },
  };
  const deletedTrip = await worker.fetch(request('/api/trips/2', deleteTripOptions), env, context());
  assert.equal(deletedTrip.status, 200);
  const replayDeletedTrip = await worker.fetch(request('/api/trips/2', deleteTripOptions), env, context());
  assert.equal(replayDeletedTrip.status, 200);
  assert.equal(replayDeletedTrip.headers.get('idempotent-replay'), 'true');
  assert.equal((await replayDeletedTrip.json()).deleted, 2);
  assert.equal(await DB.prepare('SELECT id FROM trips WHERE id = 2').first(), null);

  const shareOptions = {
    method: 'POST',
    headers: { cookie: oldCookie, 'idempotency-key': 'journey-share-retry-1' },
  };
  const createdShare = await worker.fetch(request('/api/journeys/1/share', shareOptions), env, context());
  assert.equal(createdShare.status, 200);
  const shareBody = await createdShare.json();
  const replayShare = await worker.fetch(request('/api/journeys/1/share', shareOptions), env, context());
  assert.equal(replayShare.status, 200);
  assert.equal(replayShare.headers.get('idempotent-replay'), 'true');
  assert.equal((await replayShare.json()).share_token, shareBody.share_token);

  const revokeOptions = {
    method: 'DELETE',
    headers: { cookie: oldCookie, 'idempotency-key': 'journey-revoke-retry-1' },
  };
  const revokedShare = await worker.fetch(request('/api/journeys/1/share', revokeOptions), env, context());
  assert.equal(revokedShare.status, 200);
  const replayRevokedShare = await worker.fetch(request('/api/journeys/1/share', revokeOptions), env, context());
  assert.equal(replayRevokedShare.status, 200);
  assert.equal(replayRevokedShare.headers.get('idempotent-replay'), 'true');
  assert.equal((await DB.prepare('SELECT share_token FROM journeys WHERE id = 1').first()).share_token, null);

  const originalFetch = globalThis.fetch;
  let emailAttempts = 0;
  globalThis.fetch = async () => {
    emailAttempts += 1;
    if (emailAttempts < 3) return new Response(JSON.stringify({ error: 'temporary provider failure' }), { status: 503 });
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const invitation = await worker.fetch(request('/api/households/invitations', {
      method: 'POST',
      headers: { cookie: oldCookie, 'content-type': 'application/json', 'idempotency-key': 'invitation-retry-1' },
      body: JSON.stringify({ email: 'new-member@example.com' }),
    }), { ...env, RESEND_API_KEY: 'test-key', EMAIL_FROM: 'postcards@example.com' }, context());
    assert.equal(invitation.status, 201);
    assert.equal(emailAttempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const switched = await worker.fetch(request('/api/households/switch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: oldCookie },
    body: JSON.stringify({ householdId: 2 }),
  }), env, context());
  assert.equal(switched.status, 200);
  const newCookie = cookieFrom(switched);
  assert.notEqual(newCookie, oldCookie);

  const stale = await worker.fetch(request('/api/auth/me', { headers: { cookie: oldCookie } }), env, context());
  assert.equal(stale.status, 401);
  const current = await worker.fetch(request('/api/auth/me', { headers: { cookie: newCookie } }), env, context());
  assert.equal(current.status, 200);
  assert.equal((await current.json()).active_household_id, 2);
  const crossHouseholdMedia = await worker.fetch(request('/photos/households/1/trips/1/original/photo.jpg', { headers: { cookie: newCookie } }), env, context());
  assert.equal(crossHouseholdMedia.status, 404);
  DB.close();
});
