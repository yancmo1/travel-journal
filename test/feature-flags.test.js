import test from 'node:test';
import assert from 'node:assert/strict';
import { featureEnabled } from '../worker/sites-static.js';

test('feature flags default on and accept explicit disable values', () => {
  assert.equal(featureEnabled({}, 'ENABLE_UPLOADS'), true);
  assert.equal(featureEnabled({ ENABLE_UPLOADS: 'false' }, 'ENABLE_UPLOADS'), false);
  assert.equal(featureEnabled({ ENABLE_UPLOADS: 'OFF' }, 'ENABLE_UPLOADS'), false);
  assert.equal(featureEnabled({ ENABLE_UPLOADS: '0' }, 'ENABLE_UPLOADS'), false);
  assert.equal(featureEnabled({ ENABLE_UPLOADS: 'true' }, 'ENABLE_UPLOADS'), true);
  assert.equal(featureEnabled({ ENABLE_UPLOADS: '' }, 'ENABLE_UPLOADS', false), false);
});
