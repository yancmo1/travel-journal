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
          <p>Monitor the app, backups, and the home infrastructure that keeps it running.</p>
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
            <p className="memory-eyebrow">Infrastructure monitoring</p>
            <h2 className="mt-2 text-xl font-semibold text-ocean-dark">Grafana and Prometheus</h2>
            <p className="mt-1 text-sm text-gray-600">Use the full dashboards on ubuntumac for CPU, memory, disk, containers, and network history.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ObservabilityLink label="Open Grafana" href={operations?.observability?.grafanaUrl} />
              <ObservabilityLink label="Open Prometheus" href={operations?.observability?.prometheusUrl} />
            </div>
            {!operations?.observability?.grafanaUrl && !operations?.observability?.prometheusUrl && (
              <p className="mt-3 text-xs text-gray-500">Add GRAFANA_URL and PROMETHEUS_URL to the server environment to show these links here.</p>
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
