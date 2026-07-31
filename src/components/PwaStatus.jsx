import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';

export default function PwaStatus() {
  const { offline, syncing, pendingCount, syncError, syncMutations, lastSyncedAt } = useData();
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const install = event => { event.preventDefault(); setInstallEvent(event); };
    window.addEventListener('beforeinstallprompt', install);
    return () => {
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  if (!offline && !syncing && !pendingCount && !syncError && !installEvent) return null;

  return (
    <aside className="pwa-status" aria-live="polite">
      <div className="pwa-status-copy">
        <span className={`pwa-status-dot ${offline ? 'is-offline' : 'is-online'}`} aria-hidden="true" />
        <span>
          {offline ? 'Offline mode — your memories stay available on this device.'
            : syncing ? 'Syncing saved changes…'
              : syncError ? syncError
                : pendingCount ? `${pendingCount} saved change${pendingCount === 1 ? '' : 's'} waiting to sync.`
                  : 'Your changes are synced.'}
          {!offline && !syncing && lastSyncedAt && <small> Last synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</small>}
        </span>
      </div>
      <div className="pwa-status-actions">
        {pendingCount > 0 && !offline && <button type="button" onClick={syncMutations}>Sync now</button>}
        {installEvent && <button type="button" onClick={install}>Install app</button>}
      </div>
    </aside>
  );
}
