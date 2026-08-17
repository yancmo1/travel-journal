import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity, Database, ExternalLink, Github, HardDrive, MailPlus, Palette, ShieldAlert, Trash2, X } from 'lucide-react';
import BetaTesterInvitePanel from '../components/BetaTesterInvitePanel';
import DevelopmentResetPanel from '../components/DevelopmentResetPanel';
import StyleGuidePage from './StyleGuidePage';

const OPERATIONS_SECTIONS = [
  { id: 'overview', label: 'Overview', description: 'Runtime and feedback health', icon: Activity },
  { id: 'sites-usage', label: 'Sites & usage', description: 'Private metadata and capacity', icon: HardDrive },
  { id: 'beta-testers', label: 'Beta testers', description: 'Invite private testers', icon: MailPlus },
  { id: 'style-guide', label: 'Style guide', description: 'Visual system and tokens', icon: Palette },
];

export default function OperationsPage() {
  const { user } = useAuth();
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState('overview');
  const [screenshotToView, setScreenshotToView] = useState(null);
  const [deletingReport, setDeletingReport] = useState('');
  const [pushingReport, setPushingReport] = useState('');
  const [siteToDelete, setSiteToDelete] = useState(null);
  const [siteConfirmation, setSiteConfirmation] = useState('');
  const [deletingSite, setDeletingSite] = useState('');
  const resetAvailable = operations?.development?.resetAvailable === true;
  const visibleSections = useMemo(() => resetAvailable
    ? [...OPERATIONS_SECTIONS, { id: 'development-reset', label: 'Reset dev data', description: 'Start over locally', icon: ShieldAlert }]
    : OPERATIONS_SECTIONS, [resetAvailable]);

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

  useEffect(() => {
    function selectRequestedSection(event) {
      if (visibleSections.some(item => item.id === event.detail)) setSection(event.detail);
    }
    window.addEventListener('postcards-operations-section', selectRequestedSection);
    return () => window.removeEventListener('postcards-operations-section', selectRequestedSection);
  }, [visibleSections]);

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

  async function deleteReport(report) {
    const reportId = getBugReportId(report);
    if (!reportId || !window.confirm(`Delete “${report.title}” from the local inbox? This also removes its stored screenshot. Any linked GitHub issue will remain on GitHub.`)) return;
    setDeletingReport(reportId);
    setError('');
    try {
      await api.deleteBugReport(reportId);
      setOperations(current => current
        ? { ...current, bugReports: (current.bugReports || []).filter(item => getBugReportId(item) !== reportId) }
        : current);
      setScreenshotToView(current => current && getBugReportId(current) === reportId ? null : current);
    } catch (requestError) {
      setError(requestError.message || 'The bug report could not be deleted.');
    } finally {
      setDeletingReport('');
    }
  }

  async function pushReportToGitHub(report) {
    const reportId = getBugReportId(report);
    if (!reportId || getBugGithubIssue(report)) return;
    setPushingReport(reportId);
    setError('');
    try {
      const result = await api.pushBugReportToGitHub(reportId);
      setOperations(current => current
        ? {
          ...current,
          bugReports: (current.bugReports || []).map(item => getBugReportId(item) === reportId
            ? { ...item, githubIssue: result.githubIssue, github_issue_id: result.githubIssue.id, github_issue_number: result.githubIssue.number, github_issue_url: result.githubIssue.url }
            : item),
        }
        : current);
    } catch (requestError) {
      setError(requestError.message || 'The GitHub issue could not be created.');
    } finally {
      setPushingReport('');
    }
  }

  async function deleteSite(site) {
    if (siteConfirmation !== site.name) return;
    setDeletingSite(String(site.id));
    setError('');
    try {
      const result = await api.requestAdminSiteDeletion(site.id, siteConfirmation);
      setOperations(current => current
        ? { ...current, sites: (current.sites || []).map(item => item.id === site.id ? { ...item, deletion_status: result.status } : item) }
        : current);
      setSiteToDelete(null);
      setSiteConfirmation('');
    } catch (requestError) {
      setError(requestError.message || 'The site deletion could not be started.');
    } finally {
      setDeletingSite('');
    }
  }

  return (
    <div className="space-y-6">
      <header className="settings-heading">
        <div>
          <p className="memory-eyebrow">Private operator area</p>
          <h1>Operations</h1>
          <p>{OPERATIONS_SECTIONS.find(item => item.id === section)?.description}</p>
        </div>
        {(section === 'overview' || section === 'sites-usage') && (
          <button
            type="button"
            onClick={() => loadOperations({ quiet: true })}
            disabled={loading || refreshing}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </header>

      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Operations sections">
        {visibleSections.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${section === item.id ? 'border-brand-terracotta-500 bg-brand-terracotta-500/10 text-brand-forest-800' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-terracotta-500/40'}`}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              <span>
                <strong className="block text-sm">{item.label}</strong>
                <small className="mt-0.5 block text-xs opacity-75">{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      {section === 'beta-testers' && <BetaTesterInvitePanel />}
      {section === 'development-reset' && resetAvailable && <DevelopmentResetPanel />}
      {section === 'style-guide' && <StyleGuidePage />}
      {section === 'sites-usage' && (
        <SiteUsagePanel
          operations={operations}
          onDelete={site => { setSiteToDelete(site); setSiteConfirmation(''); }}
          deletionSite={siteToDelete}
          confirmation={siteConfirmation}
          setConfirmation={setSiteConfirmation}
          onConfirmDelete={deleteSite}
          onCancelDelete={() => { setSiteToDelete(null); setSiteConfirmation(''); }}
          deletingSite={deletingSite}
        />
      )}

      {section === 'overview' && error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>}

      {section === 'overview' && (loading ? (
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
            <div className="flex flex-col gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Backup health</p>
                <h2 className="mt-1 text-xl font-semibold">{backup?.stale ? 'Backup needs attention' : 'Backups are current'}</h2>
                <p className="mt-1 max-w-none text-sm opacity-80">{backup?.message || 'The latest backup status has not been reported yet.'}</p>
              </div>
              <button
                type="button"
                onClick={runBackup}
                disabled={backingUp}
                className="rounded-lg bg-brand-terracotta-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
            <h2 className="mt-2 text-xl font-semibold text-brand-forest-800">Recent failure signals</h2>
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
            <h2 className="mt-2 text-xl font-semibold text-brand-forest-800">Recent bug reports</h2>
            <p className="mt-1 text-sm text-gray-600">Reports include the user’s description plus a request reference and browser context when available.</p>
            {operations?.bugReports?.length ? (
              <div className="mt-4 space-y-3">
                {operations.bugReports.map(report => (
                  <article key={report.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-brand-forest-800">{report.title}</h3>
                        <time className="mt-1 block text-xs text-gray-500">{formatStatusDate(report.created_at)}</time>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteReport(report)}
                        disabled={deletingReport === getBugReportId(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        {deletingReport === getBugReportId(report) ? 'Deleting…' : 'Delete report'}
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{report.details}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {getBugGithubIssue(report) ? (
                        <a
                          href={getBugGithubIssue(report).url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-terracotta-500/40 hover:text-brand-terracotta-500"
                        >
                          <Github size={14} aria-hidden="true" />
                          GitHub issue #{getBugGithubIssue(report).number} ↗
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => pushReportToGitHub(report)}
                          disabled={pushingReport === getBugReportId(report)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Github size={14} aria-hidden="true" />
                          {pushingReport === getBugReportId(report) ? 'Creating issue…' : 'Push to GitHub'}
                        </button>
                      )}
                      {getBugGithubIssue(report) && <span className="text-xs text-gray-500">Labeled Bug Report</span>}
                    </div>
                    {hasBugScreenshot(report) && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <button
                          type="button"
                          className="block w-full cursor-zoom-in text-left"
                          onClick={() => setScreenshotToView(report)}
                          aria-label={`View screenshot for ${report.title}`}
                        >
                          <img
                            src={api.getBugReportScreenshotUrl(getBugReportId(report))}
                            alt={`Screenshot attached to ${report.title}`}
                            width="800"
                            height="600"
                            loading="lazy"
                            className="max-h-72 w-full object-contain object-left-top"
                          />
                        </button>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 text-xs">
                          <span className="font-semibold text-brand-forest-800">Screenshot: {getBugScreenshotFilename(report)}</span>
                          <button type="button" className="font-semibold text-brand-terracotta-500 hover:underline" onClick={() => setScreenshotToView(report)}>View full size</button>
                        </div>
                      </div>
                    )}
                    {report.requestId && <p className="mt-2 text-xs text-gray-500">Request reference: <code>{report.requestId}</code></p>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No bug reports yet.</p>
            )}
          </section>
        </>
      ))}

      {screenshotToView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Bug report screenshot" onMouseDown={event => { if (event.target === event.currentTarget) setScreenshotToView(null); }}>
          <div className="relative max-h-full max-w-6xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-4 pb-3 pl-1">
              <p className="truncate text-sm font-semibold text-brand-forest-800">{getBugScreenshotFilename(screenshotToView)}</p>
              <div className="flex items-center gap-3">
                <a href={api.getBugReportScreenshotUrl(getBugReportId(screenshotToView))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-terracotta-500 hover:underline">
                  Open full size <ExternalLink size={14} aria-hidden="true" />
                </a>
                <button type="button" onClick={() => setScreenshotToView(null)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label="Close screenshot">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
            <img src={api.getBugReportScreenshotUrl(getBugReportId(screenshotToView))} alt={`Screenshot attached to ${screenshotToView.title}`} width="1600" height="1200" className="max-h-[78vh] max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function getBugReportId(report) {
  return report?.report_id || report?.id || '';
}

function getBugScreenshotFilename(report) {
  return report?.screenshot?.filename || report?.screenshot_filename || 'attached image';
}

function getBugGithubIssue(report) {
  if (report?.githubIssue?.url) return report.githubIssue;
  if (report?.github_issue_url) return {
    id: report.github_issue_id,
    number: report.github_issue_number,
    url: report.github_issue_url,
  };
  return null;
}

function hasBugScreenshot(report) {
  return Boolean(report?.screenshot?.key || report?.has_screenshot || report?.screenshot_filename);
}

function StatusCard({ label, value, detail, tone }) {
  const tones = {
    green: 'border-green-100 bg-green-50 text-green-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    blue: 'border-brand-paper-300 bg-brand-paper-100 text-brand-forest-800',
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
  return <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-brand-terracotta-500 px-4 py-2 text-sm font-semibold text-white">{label} ↗</a>;
}

function SiteUsagePanel({ operations, onDelete, deletionSite, confirmation, setConfirmation, onConfirmDelete, onCancelDelete, deletingSite }) {
  const database = operations?.database || {};
  const sites = operations?.sites || [];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-terracotta-500/20 bg-brand-paper-100/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="memory-eyebrow">Metadata-only monitor</p>
            <h2 className="mt-1 text-xl font-semibold text-brand-forest-800">Sites, capacity, and activity</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">This view contains operational metadata only. It does not expose photos, captions, memories, or exports.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600"><Database size={14} aria-hidden="true" /> Snapshot {formatStatusDate(operations?.checkedAt)}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Sites" value={database.households ?? 0} />
          <MetricCard label="Users" value={database.users ?? 0} />
          <MetricCard label="Physical storage" value={formatBytes(database.storage_bytes)} />
          <MetricCard label="Active · 30 days" value={database.active_sites_30d ?? 0} />
          <MetricCard label="Quota risk" value={database.quota_risk_sites ?? 0} tone={database.quota_risk_sites ? 'amber' : 'green'} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="memory-eyebrow">Per-site inventory</p><h2 className="mt-1 text-xl font-semibold text-brand-forest-800">Memory sites</h2></div>
          <p className="text-xs text-gray-500">Inactive means no meaningful write in the last 30 days.</p>
        </div>
        {sites.length ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-[0.12em] text-gray-500"><tr>
                <th className="px-4 py-3 font-semibold">Site</th><th className="px-4 py-3 font-semibold">Plan</th><th className="px-4 py-3 font-semibold">Members</th><th className="px-4 py-3 font-semibold">Memories</th><th className="px-4 py-3 font-semibold">Photos</th><th className="px-4 py-3 font-semibold">Physical storage</th><th className="px-4 py-3 font-semibold">Last write</th><th className="px-4 py-3 font-semibold">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {sites.map(site => <tr key={site.id} className="align-top">
                  <td className="px-4 py-4"><p className="font-semibold text-brand-forest-800">{site.name}</p><p className="mt-1 font-mono text-xs text-gray-400">ID {site.id}</p>{site.deletion_status && <p className="mt-1 text-xs font-semibold text-amber-700">Deletion {site.deletion_status}</p>}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{site.plan}</span></td>
                  <td className="px-4 py-4 text-gray-700">{site.member_count}</td>
                  <td className="px-4 py-4 text-gray-700">{site.trip_count}<span className="block text-xs text-gray-400">{site.journey_count} journey{site.journey_count === 1 ? '' : 's'}</span></td>
                  <td className="px-4 py-4 text-gray-700">{site.photo_count}</td>
                  <td className="px-4 py-4"><p className={`font-semibold ${site.quota_risk ? 'text-amber-800' : 'text-gray-700'}`}>{formatBytes(site.storage_bytes)}</p><p className="mt-1 text-xs text-gray-400">{site.storage_usage_percent}% of {formatBytes(site.storage_limit_bytes)}</p></td>
                  <td className="px-4 py-4"><p className={site.active_30d ? 'text-green-700' : 'text-gray-500'}>{site.active_30d ? 'Active' : 'Inactive'}</p><p className="mt-1 text-xs text-gray-400">{formatStatusDate(site.last_write_at)}</p></td>
                  <td className="px-4 py-4"><button type="button" onClick={() => onDelete(site)} disabled={Boolean(site.deletion_status === 'pending' || site.deletion_status === 'running')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={14} aria-hidden="true" />{site.deletion_status ? 'Deletion queued' : 'Delete site'}</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No memory sites found.</p>}
      </section>

      {deletionSite && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950" role="alertdialog" aria-modal="false" aria-labelledby="delete-site-heading">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" /><div className="min-w-0 flex-1"><h2 id="delete-site-heading" className="font-semibold">Permanently delete “{deletionSite.name}”?</h2><p className="mt-2 text-sm">This removes the site’s live database records and all stored media. A final backup is created first and expires under the normal backup retention policy. The deletion cannot be undone from the live system.</p><label className="mt-4 block text-sm font-semibold" htmlFor="delete-site-confirmation">Type the exact site name to confirm</label><input id="delete-site-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-brand-forest-800" autoComplete="off" /><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => onConfirmDelete(deletionSite)} disabled={confirmation !== deletionSite.name || deletingSite === String(deletionSite.id)} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{deletingSite === String(deletionSite.id) ? 'Starting deletion…' : 'Delete permanently'}</button><button type="button" onClick={onCancelDelete} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800">Cancel</button></div></div></div>
      </div>}
    </div>
  );
}

function MetricCard({ label, value, tone = 'blue' }) {
  const tones = { blue: 'border-brand-paper-300 bg-white text-brand-forest-800', amber: 'border-amber-200 bg-amber-50 text-amber-950', green: 'border-green-200 bg-green-50 text-green-950' };
  return <div className={`rounded-xl border px-3 py-3 ${tones[tone]}`}><p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function formatStatusDate(value) {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not reported' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Not reported';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
