import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function OperationsPage() {
  const { user } = useAuth();
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [error, setError] = useState('');

  const loadOperations = useCallback(async ({ quiet = false } = {}) => {
    if (!user?.site_admin) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setOperations(await api.getOperations());
    } catch (requestError) {
      setError(requestError.message || 'Operations data is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.site_admin]);

  useEffect(() => { loadOperations(); }, [loadOperations]);

  if (!user?.site_admin) return null;

  const backup = operations?.backup;
  const backupClass = backup?.stale
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-green-200 bg-green-50 text-green-950';

  async function runBackup() {
    setBackingUp(true);
    setError('');
    try {
      await api.runBackup();
      await loadOperations({ quiet: true });
    } catch (requestError) {
      setError(requestError.message || 'The backup could not be completed.');
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="settings-heading">
        <div>
          <p className="memory-eyebrow">Private operator area</p>
          <h1>Operations</h1>
          <p>Monitor the app, backups, Cloudflare runtime, and account delivery health.</p>
        </div>
        <button
          type="button"
          onClick={() => loadOperations({ quiet: true })}
          disabled={loading || refreshing}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}

      {loading ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading operations data…</section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard label="Application" value="Online" detail={formatStatusDate(operations?.checkedAt)} tone="green" />
            <StatusCard label="Database" value={operations?.database?.status === 'connected' ? 'Connected' : 'Needs attention'} detail={`${operations?.database?.users ?? 0} users · ${operations?.database?.trips ?? 0} memories`} tone={operations?.database?.status === 'connected' ? 'green' : 'amber'} />
            <StatusCard label="Photos" value={String(operations?.database?.photos ?? 0)} detail="Tracked photo records" tone="blue" />
            <StatusCard label="Backup" value={backup?.stale ? 'Needs attention' : 'Current'} detail={backup?.lastSuccessfulBackupAt ? formatStatusDate(backup.lastSuccessfulBackupAt) : 'No successful backup reported'} tone={backup?.stale ? 'amber' : 'green'} />
          </section>

          <section className={`rounded-2xl border p-5 shadow-sm ${backupClass}`} aria-live="polite">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Backup health</p>
                <h2 className="mt-1 text-xl font-semibold">{backup?.stale ? 'Backup needs attention' : 'Backups are current'}</h2>
                <p className="mt-1 max-w-xl text-sm opacity-80">{backup?.message || 'The latest backup status has not been reported yet.'}</p>
              </div>
              <button
                type="button"
                onClick={runBackup}
                disabled={backingUp}
                className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {backingUp ? 'Backing up…' : 'Back up now'}
              </button>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <Metric label="Last backup" value={formatStatusDate(backup?.lastSuccessfulBackupAt)} />
              <Metric label="Database export" value={formatBytes(backup?.databaseDumpBytes)} />
              <Metric label="Photos protected" value={formatBytes(backup?.protectedPhotoBytes || backup?.photoStorageBytes)} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="memory-eyebrow">Cloudflare monitoring</p>
            <h2 className="mt-2 text-xl font-semibold text-ocean-dark">Recent failure signals</h2>
            <p className="mt-1 text-sm text-gray-600">These counters cover the last {operations?.observability?.windowHours || 24} hours. Use Workers Logs for request-level details.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FailureMetric label="Failed logins" data={operations?.observability?.failures?.logins} />
              <FailureMetric label="Failed uploads" data={operations?.observability?.failures?.uploads} />
              <FailureMetric label="Failed backups" data={operations?.observability?.failures?.backups} />
              <FailureMetric label="Worker errors" data={operations?.observability?.failures?.workerErrors} />
              <FailureMetric label="Email failures" data={operations?.observability?.failures?.email} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <ObservabilityLink label="Open Grafana" href={operations?.observability?.grafanaUrl} />
              <ObservabilityLink label="Open Prometheus" href={operations?.observability?.prometheusUrl} />
            </div>
            {!operations?.observability?.grafanaUrl && !operations?.observability?.prometheusUrl && (
              <p className="mt-3 text-xs text-gray-500">Add GRAFANA_URL and PROMETHEUS_URL to the server environment to show these links here.</p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="memory-eyebrow">Feedback inbox</p>
            <h2 className="mt-2 text-xl font-semibold text-ocean-dark">Recent bug reports</h2>
            <p className="mt-1 text-sm text-gray-600">Reports include the user’s description plus a request reference and browser context when available.</p>
            {operations?.bugReports?.length ? (
              <div className="mt-4 space-y-3">
                {operations.bugReports.map(report => (
                  <article key={report.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-ocean-dark">{report.title}</h3>
                      <time className="text-xs text-gray-500">{formatStatusDate(report.created_at)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{report.details}</p>
                    {report.requestId && <p className="mt-2 text-xs text-gray-500">Request reference: <code>{report.requestId}</code></p>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No bug reports yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusCard({ label, value, detail, tone }) {
  const tones = {
    green: 'border-green-100 bg-green-50 text-green-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-65">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-white/60 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function FailureMetric({ label, data }) {
  const count = Number(data?.count || 0);
  const latest = data?.latest_at ? `Latest ${formatStatusDate(data.latest_at)}` : 'None recorded';
  if (count) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950"><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p><p className="mt-1 text-[11px] text-amber-800">{latest}</p></div>;
  }
  return <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-gray-700"><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p><p className="mt-1 text-[11px] text-gray-600">{latest}</p></div>;
}

function ObservabilityLink({ label, href }) {
  if (!href) return <span className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400">{label} not configured</span>;
  return <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white">{label} ↗</a>;
}

function formatStatusDate(value) {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not reported' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Not reported';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
