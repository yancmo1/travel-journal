#!/usr/bin/env node

// Bounded authenticated read probe. It intentionally refuses production hosts.
const target = new URL(process.env.CLOUDFLARE_LOAD_TARGET || 'https://travel-journal-staging.yancmo.workers.dev');
const allowedHost = 'travel-journal-staging.yancmo.workers.dev';
if (target.hostname !== allowedHost && process.env.ALLOW_NON_STAGING_LOAD_TEST !== 'true') {
  throw new Error(`Refusing authenticated load test target ${target.hostname}; use the isolated staging Worker or explicitly opt in.`);
}

const email = String(process.env.STAGING_LOAD_EMAIL || '').trim();
const password = String(process.env.STAGING_LOAD_PASSWORD || '');
if (!email || !password) throw new Error('STAGING_LOAD_EMAIL and STAGING_LOAD_PASSWORD are required.');

const requestCount = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_REQUESTS || 30), 1), 200);
const concurrency = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_CONCURRENCY || 3), 1), 10);
const timeoutMs = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_TIMEOUT_MS || 10000), 1000), 30000);
const routes = [
  { name: 'auth-me', path: '/api/auth/me', expected: 200 },
  { name: 'households', path: '/api/households', expected: 200 },
  { name: 'travelers', path: '/api/travelers', expected: 200 },
  { name: 'journeys', path: '/api/journeys?paginate=true&limit=25', expected: 200 },
  { name: 'trips', path: '/api/trips?paginate=true&limit=25', expected: 200 },
  { name: 'analytics', path: '/api/analytics', expected: 200 },
  // A normal beta member must be denied; an operator fixture can opt in to 200.
  { name: 'operations', path: '/api/admin/operations', expected: process.env.STAGING_LOAD_EXPECT_ADMIN === 'true' ? 200 : 403 },
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

async function login() {
  const response = await fetch(new URL('/api/auth/login', target), {
    method: 'POST',
    headers: { origin: target.origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Staging login failed with HTTP ${response.status}`);
  const setCookie = response.headers.get('set-cookie');
  const cookie = setCookie?.split(';', 1)[0];
  if (!cookie) throw new Error('Staging login did not return a session cookie.');
  return cookie;
}

async function sample(route, cookie) {
  const started = performance.now();
  let status = 0;
  let error = null;
  try {
    const response = await fetch(new URL(route.path, target), {
      headers: { origin: target.origin, cookie },
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    await response.arrayBuffer();
  } catch (caught) {
    error = String(caught?.message || caught);
  }
  return { durationMs: performance.now() - started, status, error };
}

async function runRoute(route, cookie) {
  const results = [];
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= requestCount) return;
      results[index] = await sample(route, cookie);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
  const durations = results.map(result => result.durationMs);
  const failures = results.filter(result => result.status !== route.expected || result.error);
  return {
    requests: requestCount,
    expectedStatus: route.expected,
    failures: failures.length,
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    maxMs: Math.round(Math.max(...durations)),
    statuses: Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status || 'error', results.filter(result => result.status === status).length])),
    errors: failures.slice(0, 3).map(result => result.error || `HTTP ${result.status}`),
  };
}

const startedAt = new Date().toISOString();
const cookie = await login();
const results = {};
for (const route of routes) results[route.name] = await runRoute(route, cookie);
const budgetMs = 1000;
const failedBudgets = Object.entries(results).filter(([, result]) => result.failures > 0 || result.p95Ms > budgetMs);
const report = {
  target: target.origin,
  startedAt,
  requestCount,
  concurrency,
  authenticated: true,
  p95BudgetMs: budgetMs,
  routes: results,
  passed: failedBudgets.length === 0,
};
console.log(JSON.stringify(report, null, 2));
if (failedBudgets.length) process.exitCode = 1;
