const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({
        error: 'Sign-in will open after the private family archive has been migrated.',
      }), { status: 503, headers: jsonHeaders });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;

    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  },
};
