import React, { useState } from 'react';
import DataBackupPanel from '../components/DataBackupPanel';
import CleanupPage from './CleanupPage';
import PeoplePage from './PeoplePage';
import { APP_VERSION } from '../config/app';
import AccountAccessPanel from '../components/AccountAccessPanel';
import StyleGuidePage from './StyleGuidePage';

const SECTIONS = [
  { id: 'overview', label: 'Settings', description: 'Your data and app details', icon: '⚙' },
  { id: 'people', label: 'People', description: 'Manage family members and relationships', icon: '♧' },
  { id: 'access', label: 'Family access', description: 'Accounts, invitations, and memory sites', icon: '◇' },
  { id: 'cleanup', label: 'Clean up', description: 'Review incomplete or duplicate memories', icon: '✓' },
  { id: 'style-guide', label: 'Style guide', description: 'The visual system and CSS tokens', icon: '✦' },
];

export default function SettingsPage({ setPage, setTravelerFilter }) {
  const [section, setSection] = useState('overview');

  return (
    <div className="settings-layout">
      <header className="settings-heading">
        <div>
          <p className="memory-eyebrow">The practical side of our story</p>
          <h1>Settings</h1>
          <p>Keep your account, family details, and data tools together.</p>
        </div>
      </header>

      <div className="settings-grid">
        <aside className="settings-sidebar" aria-label="Settings sections">
          {SECTIONS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              title={item.description}
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
          {section === 'access' && <AccountAccessPanel />}
          {section === 'cleanup' && <CleanupPage />}
          {section === 'style-guide' && <StyleGuidePage />}
        </main>
      </div>
    </div>
  );
}

function SettingsOverview() {
  return (
    <div className="settings-overview space-y-6">
      <DataBackupPanel />

      <section className="settings-about-card rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="memory-eyebrow">About this app</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ocean-dark">Postcards of Us</h2>
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
