import test from 'node:test';
import assert from 'node:assert/strict';
import { backupObjectReusable } from '../worker/sites-static.js';

test('backup media manifests reuse only unchanged objects with a verified archive key', () => {
  const object = { etag: 'etag-a', size: 100 };
  assert.equal(backupObjectReusable({ backupKey: '_backups/media/a', etag: 'etag-a', size: 100 }, object), true);
  assert.equal(backupObjectReusable({ backupKey: '_backups/media/a', etag: 'etag-b', size: 100 }, object), false);
  assert.equal(backupObjectReusable({ backupKey: '_backups/media/a', etag: 'etag-a', size: 99 }, object), false);
  assert.equal(backupObjectReusable({ etag: 'etag-a', size: 100 }, object), false);
});
