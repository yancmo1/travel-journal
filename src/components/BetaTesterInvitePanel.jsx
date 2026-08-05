import React, { useMemo, useState } from 'react';
import { MailPlus, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function BetaTesterInvitePanel() {
  const { households, activeHouseholdId } = useAuth();
  const active = useMemo(
    () => households.find(site => Number(site.id) === Number(activeHouseholdId)),
    [households, activeHouseholdId],
  );
  const [email, setEmail] = useState('');
  const [siteName, setSiteName] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canInvite = ['owner', 'admin'].includes(active?.role);

  async function handleSubmit(event) {
    event.preventDefault();
    setWorking(true);
    setMessage('');
    setError('');

    try {
      const result = await api.inviteBetaTester(email.trim(), siteName.trim());
      setEmail('');
      setSiteName('');
      setMessage(result.message || 'Invitation sent.');
    } catch (err) {
      setError(err.message || 'The invitation could not be sent.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="settings-section-stack settings-beta-testers space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ocean-blue/10 text-ocean-blue" aria-hidden="true">
            <MailPlus size={22} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="memory-eyebrow">Private beta</p>
            <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Invite a beta tester</h2>
            <p className="mt-2 max-w-none text-sm leading-6 text-gray-600">
              Send someone a private invitation to try Postcards of Us. They’ll receive a secure link to create an account and start their own memory site.
            </p>
          </div>
        </div>

        {!active ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            Select a memory site before inviting a beta tester.
          </div>
        ) : !canInvite ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            Only the owner or an administrator can send beta invitations for this memory site.
          </div>
        ) : (
          <form className="mt-5 border-t border-gray-100 pt-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700" htmlFor="beta-tester-email">
              Tester’s email address
              <span className="mt-1 block text-xs font-normal text-gray-500">Use the exact address they check for the invitation.</span>
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="beta-tester-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="tester@example.com"
                autoComplete="email"
                required
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2.5"
              />
              <label className="block text-sm font-medium text-gray-700 sm:w-72" htmlFor="beta-tester-site-name">
                Their site name
                <span className="mt-1 block text-xs font-normal text-gray-500">This becomes their private memory site.</span>
                <input
                  id="beta-tester-site-name"
                  type="text"
                  value={siteName}
                  onChange={event => setSiteName(event.target.value)}
                  placeholder="The Johnsons"
                  autoComplete="organization"
                  minLength={2}
                  maxLength={80}
                  required
                  className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2.5"
                />
              </label>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ocean-blue px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={working}
              >
                <Send size={16} aria-hidden="true" />
                {working ? 'Sending…' : 'Send invitation'}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">They’ll join this new site as its owner with full privileges. Invitations expire after 7 days.</p>
          </form>
        )}

        {(message || error) && (
          <div className={`mt-4 rounded-xl p-4 text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`} role={error ? 'alert' : 'status'}>
            {error || message}
          </div>
        )}
      </section>
    </div>
  );
}
