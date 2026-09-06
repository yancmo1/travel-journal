import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/sites-static.js';

function context() {
  return { waitUntil() {} };
}

function assets(body = 'asset') {
  return {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      return new Response(pathname === '/index.html' ? '<html></html>' : body, {
        status: 200,
        headers: { 'content-type': pathname === '/index.html' ? 'text/html' : 'application/javascript' },
      });
    },
  };
}

test('hashed static assets are immutable while the app shell revalidates', async () => {
  const env = { ASSETS: assets() };
  const assetResponse = await worker.fetch(new Request('https://postcards.test/assets/app-hash.js'), env, context());
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const shellResponse = await worker.fetch(new Request('https://postcards.test/'), env, context());
  assert.equal(shellResponse.status, 200);
  assert.equal(shellResponse.headers.get('cache-control'), 'public, max-age=60, must-revalidate');
});

test('runtime config exposes the CARTO key without caching or unrelated variables', async () => {
  const env = {
    ASSETS: assets(),
    VITE_CARTO_BASEMAP_KEY: 'carto-test-key',
    JWT_SECRET: 'must-not-leak',
  };
  const response = await worker.fetch(new Request('https://postcards.test/api/runtime-config'), env, context());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { cartoBasemapKey: 'carto-test-key' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
