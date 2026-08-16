import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AccountAccessPanel() {
  const { user, households, activeHouseholdId, switchHousehold } = useAuth();
  const active = useMemo(() => households.find(site => Number(site.id) === Number(activeHouseholdId)), [households, activeHouseholdId]);
  const ownedSites = useMemo(() => households.filter(site => ['owner', 'admin'].includes(site.role)), [households]);
  const [access, setAccess] = useState({ members: [], invitations: [], role: active?.role || 'member', max_members: 2 });
  const [inviteEmail, setInviteEmail] = useState('');
  const [siteName, setSiteName] = useState('');
  const [rename, setRename] = useState(active?.name || '');
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

  useEffect(() => { loadAccess(); setRename(active?.name || ''); }, [activeHouseholdId, active?.name]);

  const accessSlotsUsed = access.members.length + access.invitations.length;
  const canInviteMember = ['owner', 'admin'].includes(access.role) && accessSlotsUsed < Number(access.max_members || 2);

  async function run(kind, action) {
    setWorking(kind); setMessage(''); setError('');
    try { await action(); }
    catch (err) { setError(err.message || 'That change could not be completed.'); }
    finally { setWorking(''); }
  }

  async function renameSite(event) {
    event.preventDefault();
    await run('rename', async () => {
      const result = await api.renameCurrentHousehold(rename);
      setMessage('Memory site renamed.');
      window.location.reload();
      return result;
    });
  }

  async function changeRole(member, role) {
    await run(`role-${member.id}`, async () => { await api.updateHouseholdMember(member.id, role); setMessage('Access role updated.'); await loadAccess(); });
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.display_name || member.email} from this memory site?`)) return;
    await run(`remove-${member.id}`, async () => { await api.removeHouseholdMember(member.id); setMessage('Person removed from this memory site.'); await loadAccess(); });
  }

  async function cancelInvite(invite) {
    if (!window.confirm(`Cancel the invitation for ${invite.email}?`)) return;
    await run(`cancel-${invite.id}`, async () => { await api.cancelHouseholdInvitation(invite.id); setMessage('Invitation cancelled.'); await loadAccess(); });
  }

  async function resendInvite(invite) {
    await run(`resend-${invite.id}`, async () => { const result = await api.resendHouseholdInvitation(invite.id); setMessage(result.message); await loadAccess(); });
  }

  return <div className="settings-section-stack settings-access space-y-6">
    <header className="flex flex-col gap-2">
      <p className="memory-eyebrow">Family access</p>
      <h1 className="text-3xl font-semibold text-ocean-dark sm:text-4xl">Share your story with the right people</h1>
      <p className="text-gray-600">Manage memory sites, invitations, and account security for your family.</p>
    </header>

    <section className="rounded-2xl border border-ocean-blue/20 bg-sky-50/60 p-5 shadow-sm">
      <p className="memory-eyebrow">Memory sites</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Choose the story you’re working on</h2>
      <p className="mt-2 text-sm text-gray-600">Site switching lives here so the main navigation stays focused. Each site keeps its people, memories, and photos separate.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ownedSites.map(site => (
          <button
            key={site.id}
            type="button"
            onClick={() => switchHousehold(site.id)}
            className={`rounded-xl border p-3 text-left transition ${Number(site.id) === Number(activeHouseholdId) ? 'border-ocean-blue bg-white text-ocean-dark shadow-sm' : 'border-gray-200 bg-white/70 text-gray-700 hover:border-ocean-blue/50'}`}
            aria-pressed={Number(site.id) === Number(activeHouseholdId)}
          >
            <span className="block font-semibold">{site.name}</span>
            <span className="mt-1 block text-xs text-gray-500">{Number(site.id) === Number(activeHouseholdId) ? 'Currently selected' : 'Switch to this site'} · {site.member_count || 0} member{Number(site.member_count) === 1 ? '' : 's'}</span>
          </button>
        ))}
        {!ownedSites.length && <p className="rounded-xl bg-white/70 p-4 text-sm text-gray-600">You do not own or administer any memory sites yet.</p>}
      </div>
      {active && ['owner', 'admin'].includes(active.role) && <form className="mt-5 border-t border-ocean-blue/10 pt-4" onSubmit={renameSite}>
        <label className="block text-sm font-semibold text-gray-700" htmlFor="memory-site-name">Site name</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="memory-site-name" value={rename} onChange={event => setRename(event.target.value)} minLength={2} maxLength={80} required className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" /><button className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={working === 'rename'}>{working === 'rename' ? 'Saving…' : 'Rename site'}</button></div>
      </form>}
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Your account</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Secure email identity</h2>
      <div className={`mt-3 rounded-xl border p-4 text-sm ${user.email_verified_at ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-semibold">{user.email}</p><p className="mt-1">{user.email_verified_at ? 'Verified for sign-in, invitations, and password recovery.' : 'Please verify this address to use password recovery.'}</p>{!user.email_verified_at && <button type="button" className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold" onClick={() => run('verification', async () => { const result = await api.resendVerification(); setMessage(result.message); })} disabled={working === 'verification'}>{working === 'verification' ? 'Sending…' : 'Send verification email'}</button>}</div>
      <form className="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); if (newPassword !== passwordConfirmation) { setError('The new passwords do not match.'); return; } run('password', async () => { const result = await api.changePassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation(''); setMessage(result.message); }); }}>
        <input type="text" name="username" autoComplete="username" value={user.email || ''} readOnly tabIndex="-1" aria-hidden="true" className="sr-only" />
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
        {access.members.map(member => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-gray-900">{member.display_name || member.email || 'Family member'}</p><p className="text-sm text-gray-500">{member.email}</p></div><div className="flex flex-wrap items-center gap-2">{member.role === 'owner' ? <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">Owner</span> : ['owner'].includes(access.role) ? <select value={member.role} onChange={event => changeRole(member, event.target.value)} disabled={working === `role-${member.id}`} className="rounded-lg border border-gray-200 px-2 py-1 text-sm"><option value="member">Member</option><option value="admin">Admin</option></select> : <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">{member.role}</span>}{member.role !== 'owner' && ['owner', 'admin'].includes(access.role) && <button type="button" onClick={() => removeMember(member)} disabled={working === `remove-${member.id}`} className="text-sm font-semibold text-red-700">Remove</button>}</div></div>)}
        {access.invitations.map(invite => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-gray-900">{invite.email}</p><p className="text-sm text-amber-700">Invitation pending · expires {new Date(invite.expires_at).toLocaleDateString()}</p></div>{['owner', 'admin'].includes(access.role) && <div className="flex gap-3"><button type="button" onClick={() => resendInvite(invite)} disabled={working === `resend-${invite.id}`} className="text-sm font-semibold text-ocean-blue">Resend</button><button type="button" onClick={() => cancelInvite(invite)} disabled={working === `cancel-${invite.id}`} className="text-sm font-semibold text-red-700">Cancel</button></div>}</div>)}
      </div>
      {['owner', 'admin'].includes(access.role) && <form className="mt-4 border-t border-gray-100 pt-4" onSubmit={event => { event.preventDefault(); run('invite', async () => { const result = await api.inviteHouseholdMember(inviteEmail); setInviteEmail(''); setMessage(result.message); await loadAccess(); }); }}>
        <label className="text-sm font-semibold text-gray-700" htmlFor="invite-family-member">Invite someone to this memory site <span className="font-normal text-gray-500">{canInviteMember ? `${access.max_members - accessSlotsUsed} spot${access.max_members - accessSlotsUsed === 1 ? '' : 's'} remaining.` : `This site has reached its ${access.max_members}-person access limit.`}</span></label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input id="invite-family-member" type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="family@example.com" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 disabled:bg-gray-50" required disabled={!canInviteMember} />
          <button className="rounded-lg border border-ocean-blue px-4 py-2 text-sm font-semibold text-ocean-blue disabled:cursor-not-allowed disabled:opacity-50" disabled={!canInviteMember || working === 'invite'}>{working === 'invite' ? 'Sending…' : 'Send invitation'}</button>
        </div>
        {!canInviteMember && <p className="mt-2 text-xs text-gray-500">Remove a person or upgrade this memory site to invite someone new.</p>}
      </form>}
    </section>

    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Session security</p>
      <h2 className="mt-1 text-xl font-semibold text-ocean-dark">Control where you are signed in</h2>
      <p className="mt-2 max-w-none text-sm text-gray-600">Sign out other devices after changing a password or if you no longer recognize a session.</p>
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
      <p className="mt-2 max-w-none text-sm text-gray-600">Everyone can belong to several family sites and own one of their own. Memories and photos stay separated between sites.</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); run('site', async () => { await api.createHousehold(siteName); window.location.href = '/'; }); }}>
        <input value={siteName} onChange={event => setSiteName(event.target.value)} placeholder="The Shepherd Family" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" minLength={2} maxLength={80} required />
        <button className="rounded-lg border border-ocean-blue px-4 py-2 text-sm font-semibold text-ocean-blue disabled:opacity-60" disabled={working === 'site'}>{working === 'site' ? 'Creating…' : 'Create memory site'}</button>
      </form>
    </section>

    {(message || error) && <div className={`rounded-xl p-4 text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`} role="status">{error || message}</div>}
  </div>;
}
