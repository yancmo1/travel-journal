import React, { useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import api from '../utils/api';

const CONFIRMATION = 'WIPE DEV DATA';

export default function DevelopmentResetPanel() {
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function resetDevelopmentData(event) {
    event.preventDefault();
    if (confirmation.trim() !== CONFIRMATION || working) return;
    if (!window.confirm('This permanently clears local development memories, journeys, invitations, reports, and photos while keeping your configured dev account. Continue?')) return;
    setWorking(true);
    setError('');
    try {
      await api.resetDevelopmentData(CONFIRMATION);
      window.location.assign('/?login=1');
    } catch (requestError) {
      setError(requestError.message || 'The development data could not be reset.');
      setWorking(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-red-950 shadow-sm" aria-labelledby="development-reset-heading">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Development only</p>
          <h2 id="development-reset-heading" className="mt-1 text-xl font-semibold">Start over with a clean dev account</h2>
          <p className="mt-2 max-w-2xl text-sm text-red-900/80">This clears local development memories, journeys, invitations, reports, and uploaded photos. It keeps your configured development account and does not change the database schema or production data. You will be sent to sign in again as a fresh user.</p>
          <form onSubmit={resetDevelopmentData} className="mt-5 max-w-xl">
            <label htmlFor="development-reset-confirmation" className="block text-sm font-semibold">Type {CONFIRMATION} to continue</label>
            <input id="development-reset-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck="false" className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-brand-forest-800 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={confirmation.trim() !== CONFIRMATION || working} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCcw size={16} aria-hidden="true" />{working ? 'Resetting…' : 'Wipe dev data'}</button>
              <span className="text-xs text-red-800/70">This cannot be undone.</span>
            </div>
          </form>
          {error && <p className="mt-4 rounded-lg border border-red-300 bg-white/70 p-3 text-sm text-red-800" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
}
