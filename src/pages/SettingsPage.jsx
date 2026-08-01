import React, { useState } from 'react';
import DataBackupPanel from '../components/DataBackupPanel';
import CleanupPage from './CleanupPage';
import PeoplePage from './PeoplePage';
import { useData } from '../context/DataContext';
import { APP_VERSION } from '../config/app';

const SECTIONS = [
  { id: 'overview', label: 'Settings', description: 'Backup, storage, and app details', icon: '⚙' },
  { id: 'people', label: 'People', description: 'Manage family members and relationships', icon: '♧' },
  { id: 'cleanup', label: 'Clean up', description: 'Review incomplete or duplicate memories', icon: '✓' },
];

export default function SettingsPage({ setPage, setTravelerFilter }) {
  const [section, setSection] = useState('overview');

  return (
    <div className="settings-layout">
      <header className="settings-heading">
        <div>
          <p className="memory-eyebrow">The practical side of our story</p>
          <h1>Settings</h1>
          <p>Keep the family details, backups, and maintenance tools together.</p>
        </div>
      </header>

      <div className="settings-grid">
        <aside className="settings-sidebar" aria-label="Settings sections">
          {SECTIONS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={section === item.id ? 'is-active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <span className="settings-sidebar-icon" aria-hidden="true">{item.icon}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <main className="settings-content">
          {section === 'overview' && <SettingsOverview />}
          {section === 'people' && (
            <PeoplePage setPage={setPage} setTravelerFilter={setTravelerFilter} />
          )}
          {section === 'cleanup' && <CleanupPage />}
        </main>
      </div>
    </div>
  );
}

function SettingsOverview() {
  const { backupStatus } = useData();
  const statusClass = backupStatus?.stale
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-green-200 bg-green-50 text-green-950';

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-5 shadow-sm ${statusClass}`} aria-live="polite">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Backup health</p>
            <h2 className="mt-1 text-xl font-semibold">
              {backupStatus?.stale ? 'Backup needs attention' : backupStatus ? 'Backups are current' : 'Checking backup status…'}
            </h2>
            <p className="mt-1 max-w-xl text-sm opacity-80">
              {backupStatus?.message || (backupStatus?.stale
                ? 'The last successful R2 backup is outside the expected window.'
                : 'The Ubuntu backup job is reporting normally.')}
            </p>
          </div>
          {backupStatus && (
            <div className="grid grid-cols-1 gap-2 text-sm sm:min-w-[19rem] sm:grid-cols-3">
              <BackupMetric label="Last backup" value={formatStatusDate(backupStatus.lastSuccessfulBackupAt)} />
              <BackupMetric label="DB dump" value={formatStatusDate(backupStatus.lastDatabaseDumpAt)} />
              <BackupMetric label="Photos on disk" value={formatBytes(backupStatus.photoStorageBytes)} />
            </div>
          )}
        </div>
      </section>

      <DataBackupPanel />

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="memory-eyebrow">About this app</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ocean-dark">Tracing Time</h2>
            <p className="mt-1 text-sm text-gray-600">Private family travel memories, available offline.</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">App version</p>
            <p className="mt-1 font-mono text-sm font-semibold text-ocean-dark">v{APP_VERSION}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function BackupMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-white/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
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
