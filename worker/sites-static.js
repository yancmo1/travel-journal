const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...jsonHeaders, ...init.headers },
  });
}

async function health(env) {
  const tableChecks = ['users', 'households', 'travelers', 'journeys', 'trips', 'photos']
    .map(table => env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`));
  const results = await env.DB.batch(tableChecks);
  const counts = results.map(result => Number(result.results?.[0]?.count || 0));
  await env.MEDIA.head('__postcards_healthcheck__');

  return json({
    status: 'ok',
    database: 'connected',
    storage: 'connected',
    schema: 'ready',
    empty: counts.every(count => count === 0),
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      try {
        return await health(env);
      } catch (error) {
        console.error('Postcards health check failed', error);
        return json({ status: 'error', database: 'unavailable' }, { status: 503 });
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json({
        error: 'Sign-in will open after the private family archive has been migrated.',
      }, { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;

    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  },
};
