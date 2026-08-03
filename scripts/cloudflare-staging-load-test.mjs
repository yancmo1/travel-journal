#!/usr/bin/env node

// Read-only baseline probe. It intentionally refuses production hostnames.
const target = new URL(process.env.CLOUDFLARE_LOAD_TARGET || 'https://travel-journal-staging.yancmo.workers.dev');
const allowedHost = 'travel-journal-staging.yancmo.workers.dev';
if (target.hostname !== allowedHost && process.env.ALLOW_NON_STAGING_LOAD_TEST !== 'true') {
  throw new Error(`Refusing load test target ${target.hostname}; use the isolated staging Worker or explicitly opt in.`);
}

const requestCount = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_REQUESTS || 60), 1), 500);
const concurrency = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_CONCURRENCY || 6), 1), 20);
const timeoutMs = Math.min(Math.max(Number(process.env.CLOUDFLARE_LOAD_TIMEOUT_MS || 10000), 1000), 30000);
const routes = [
  { name: 'health', path: '/api/health', expected: 200 },
  { name: 'shell', path: '/', expected: 200 },
  { name: 'unauthenticated-auth', path: '/api/auth/me', expected: 401 },
  { name: 'migration-guard', path: '/api/migration/status', expected: 404 },
];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] || 0;
}

async function sample(route) {
  const started = performance.now();
  let status = 0;
  let error = null;
  try {
    const response = await fetch(new URL(route.path, target), { signal: AbortSignal.timeout(timeoutMs) });
    status = response.status;
    await response.arrayBuffer();
  } catch (caught) {
    error = String(caught?.message || caught);
  }
  return { durationMs: performance.now() - started, status, error };
}

async function runRoute(route) {
  const results = [];
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= requestCount) return;
      results[index] = await sample(route);
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
const results = {};
for (const route of routes) results[route.name] = await runRoute(route);
const budgetMs = 1000;
const failedBudgets = Object.entries(results).filter(([, result]) => result.failures > 0 || result.p95Ms > budgetMs);
const report = { target: target.origin, startedAt, requestCount, concurrency, p95BudgetMs: budgetMs, routes: results, passed: failedBudgets.length === 0 };
console.log(JSON.stringify(report, null, 2));
if (failedBudgets.length) process.exitCode = 1;
