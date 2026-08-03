import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/sites-static.js';
import { distinctMediaKeys, isSafeMediaKey, uploadMediaKey } from '../worker/lib/media.js';
import { imageSignatureMatches } from '../worker/sites-static.js';

function context() {
  return { waitUntil() {} };
}

test('media keys are tenant-scoped and reject unsafe paths', () => {
  assert.equal(
    uploadMediaKey({ householdId: 7, tripId: 42, variant: 'original', extension: 'jpg', id: 'abc' }),
    'households/7/trips/42/original/abc.jpg',
  );
  assert.equal(isSafeMediaKey('households/7/trips/42/original/abc.jpg'), true);
  assert.equal(isSafeMediaKey('../secrets.txt'), false);
  assert.equal(isSafeMediaKey('_backups/database.json'), false);
  assert.deepEqual(
    distinctMediaKeys([
      { r2_key: 'a', display_r2_key: 'b', thumbnail_r2_key: 'c' },
      { r2_key: 'a', thumbnail_r2_key: 'd' },
    ]),
    ['a', 'b', 'c', 'd'],
  );
});

test('image upload signatures reject renamed executable content and accept supported headers', () => {
  assert.equal(imageSignatureMatches(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
  assert.equal(imageSignatureMatches(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'), true);
  assert.equal(imageSignatureMatches(new TextEncoder().encode('MZ-not-an-image'), 'image/jpeg'), false);
  assert.equal(imageSignatureMatches(new TextEncoder().encode('GIF89a'), 'image/gif'), true);
  assert.equal(imageSignatureMatches(new TextEncoder().encode('RIFF1234WEBP'), 'image/webp'), true);
  assert.equal(imageSignatureMatches(new TextEncoder().encode('xxxxftypheic'), 'image/heic'), true);
});

test('private media rejects unauthenticated requests before reading R2', async () => {
  let mediaReads = 0;
  const response = await worker.fetch(
    new Request('https://postcardsofus.test/photos/households/1/private.jpg'),
    {
      DB: { prepare() { throw new Error('D1 should not be queried without a session'); } },
      MEDIA: { async get() { mediaReads += 1; return null; } },
    },
    context(),
  );

  assert.equal(response.status, 404);
  assert.equal(mediaReads, 0);
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('shared media rejects an invalid or expired share token before reading R2', async () => {
  let mediaReads = 0;
  const db = {
    prepare() {
      return {
        bind() {
          return { async first() { return null; } };
        },
      };
    },
  };
  const response = await worker.fetch(
    new Request('https://postcardsofus.test/photos/households/1/private.jpg?share=invalid'),
    { DB: db, MEDIA: { async get() { mediaReads += 1; return null; } } },
    context(),
  );

  assert.equal(response.status, 404);
  assert.equal(mediaReads, 0);
});

test('migration media writes require a household key and verify the source checksum', async () => {
  let writes = 0;
  const env = {
    MIGRATION_TOKEN: 'migration-test-token',
    ENABLE_MIGRATION_ENDPOINTS: 'true',
    DB: { prepare() { throw new Error('D1 should not be queried by media migration'); } },
    MEDIA: { async put() { writes += 1; } },
  };
  const disabled = await worker.fetch(
    new Request('https://postcardsofus.test/api/migration/status', { headers: { 'x-migration-token': env.MIGRATION_TOKEN } }),
    { ...env, ENABLE_MIGRATION_ENDPOINTS: 'false' },
    context(),
  );
  assert.equal(disabled.status, 404);

  const unsafe = await worker.fetch(
    new Request('https://postcardsofus.test/api/migration/media/_backups/secret', { method: 'PUT', headers: { 'x-migration-token': env.MIGRATION_TOKEN } }),
    env,
    context(),
  );
  assert.equal(unsafe.status, 400);
  assert.equal(writes, 0);

  const body = new TextEncoder().encode('photo');
  const valid = await worker.fetch(
    new Request('https://postcardsofus.test/api/migration/media/households/1/trips/2/original/photo.jpg', {
      method: 'PUT',
      headers: { 'x-migration-token': env.MIGRATION_TOKEN, 'x-source-sha256': '55c64d0fcd6f9d5f7c828093857e3fdfda68478bb4e9bd24d481ef391c7804e8' },
      body,
    }),
    env,
    context(),
  );
  assert.equal(valid.status, 200);
  assert.equal(writes, 1);
  assert.equal((await valid.json()).sha256, '55c64d0fcd6f9d5f7c828093857e3fdfda68478bb4e9bd24d481ef391c7804e8');
});

test('cookie-authenticated state changes require same-origin CSRF context', async () => {
  const response = await worker.fetch(
    new Request('https://postcardsofus.test/api/trips', {
      method: 'POST',
      headers: { cookie: 'postcards_session=opaque-session' },
      body: '{}',
    }),
    { DB: { prepare() { throw new Error('D1 should not be queried after CSRF rejection'); } } },
    context(),
  );
  assert.equal(response.status, 403);
});
