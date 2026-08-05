import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AccountAccessPanel() {
  const { user, households, activeHouseholdId } = useAuth();
  const active = useMemo(() => households.find(site => Number(site.id) === Number(activeHouseholdId)), [households, activeHouseholdId]);
  const [access, setAccess] = useState({ members: [], invitations: [], role: active?.role || 'member' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [siteName, setSiteName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');

  async function loadAccess() {
    try { setAccess(await api.getHouseholdMembers()); }
    catch (err) { setError(err.message || 'Family access could not be loaded.'); }
  }

  useEffect(() => { loadAccess(); }, [activeHouseholdId]);

  async function run(kind, action) {
    setWorking(kind); setMessage(''); setError('');
    try { await action(); }
    catch (err) { setError(err.message || 'That change could not be completed.'); }
    finally { setWorking(''); }
  }

  return <div className="settings-section-stack settings-access space-y-6">
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Your account</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Secure email identity</h2>
      <div className={`mt-3 rounded-xl border p-4 text-sm ${user.email_verified_at ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-semibold">{user.email}</p><p className="mt-1">{user.email_verified_at ? 'Verified for sign-in, invitations, and password recovery.' : 'Please verify this address to use password recovery.'}</p>{!user.email_verified_at && <button type="button" className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold" onClick={() => run('verification', async () => { const result = await api.resendVerification(); setMessage(result.message); })} disabled={working === 'verification'}>{working === 'verification' ? 'Sending…' : 'Send verification email'}</button>}</div>
      <form className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); if (newPassword !== passwordConfirmation) { setError('The new passwords do not match.'); return; } run('password', async () => { const result = await api.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation(''); setMessage(result.message); }); }}>
        <label className="text-sm font-medium text-gray-700">Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" required /></label>
        <label className="text-sm font-medium text-gray-700">New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" required /></label>
        <label className="text-sm font-medium text-gray-700">Confirm new password<input type="password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" required /></label>
        <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60 sm:col-span-3 sm:justify-self-start" disabled={working === 'password'}>{working === 'password' ? 'Updating…' : 'Change password'}</button>
      </form>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">People with access</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">{active?.name || 'This memory site'}</h2>
      <div className="mt-4 divide-y divide-gray-100">
        {access.members.map(member => <div key={member.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold text-gray-900">{member.display_name || member.email || 'Family member'}</p><p className="text-sm text-gray-500">{member.email}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">{member.role}</span></div>)}
        {access.invitations.map(invite => <div key={invite.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold text-gray-900">{invite.email}</p><p className="text-sm text-amber-700">Invitation pending</p></div><span className="text-xs text-gray-500">Expires {new Date(invite.expires_at).toLocaleDateString()}</span></div>)}
      </div>
      {['owner', 'admin'].includes(access.role) && <form className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row" onSubmit={event => { event.preventDefault(); run('invite', async () => { const result = await api.inviteHouseholdMember(inviteEmail); setInviteEmail(''); setMessage(result.message); await loadAccess(); }); }}>
        <input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="family@example.com" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" required />
        <button className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={working === 'invite'}>{working === 'invite' ? 'Sending…' : 'Invite by email'}</button>
      </form>}
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Session security</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Control where you are signed in</h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">Sign out other devices after changing a password or if you no longer recognize a session.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => run('sessions', async () => { const result = await api.revokeOtherSessions(); setMessage(result.message); })} disabled={working === 'sessions'} className="rounded-lg border border-ocean-blue px-4 py-2 text-sm font-semibold text-ocean-blue disabled:opacity-60">
          {working === 'sessions' ? 'Signing out…' : 'Sign out other devices'}
        </button>
        <button type="button" onClick={() => { if (window.confirm('Sign out everywhere, including this device?')) run('all-sessions', async () => { await api.revokeAllSessions(); window.location.href = '/?login=1'; }); }} disabled={working === 'all-sessions'} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60">
          Sign out everywhere
        </button>
      </div>
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Your own story</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Start another memory site</h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">Everyone can belong to several family sites and own one of their own. Memories and photos stay separated between sites.</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); run('site', async () => { await api.createHousehold(siteName); window.location.href = '/'; }); }}>
        <input value={siteName} onChange={event => setSiteName(event.target.value)} placeholder="The Shepherd Family" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" minLength={2} maxLength={80} required />
        <button className="rounded-lg border border-ocean-blue px-4 py-2 text-sm font-semibold text-ocean-blue disabled:opacity-60" disabled={working === 'site'}>{working === 'site' ? 'Creating…' : 'Create memory site'}</button>
      </form>
    </section>

    {(message || error) && <div className={`rounded-xl p-4 text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`} role="status">{error || message}</div>}
  </div>;
}
