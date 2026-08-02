import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function InvitationPage({ token }) {
  const { user, registerInvitation } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvitation(token).then(setInvitation).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [token]);

  async function createAccount(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) return setError('The passwords do not match.');
    setLoading(true);
    try { await registerInvitation(token, displayName, password); window.location.href = '/'; }
    catch (err) { setError(err.message || 'Your account could not be created.'); }
    finally { setLoading(false); }
  }

  async function acceptSignedIn() {
    setError('');
    setLoading(true);
    try { await api.acceptInvitation(token); window.location.href = '/'; }
    catch (err) { setError(err.message || 'The invitation could not be accepted.'); setLoading(false); }
  }

  function signInToAccept() {
    sessionStorage.setItem('postcards_pending_invitation', token);
    window.location.href = '/?login=1';
  }

  return (
    <main className="memory-login">
      <section className="memory-login-story">
        <a className="memory-login-brand" href="/"><span className="memory-brand-mark">P</span><span>Postcards of Us</span></a>
        <div><p className="memory-eyebrow">You’re invited</p><h1>A family story has a place for you.</h1><p>Join their memories—and keep the freedom to begin a story of your own.</p></div>
        <p className="memory-login-footnote">One account. Every family site you belong to.</p>
      </section>
      <section className="memory-login-panel"><div className="memory-login-form">
        {loading && !invitation ? <p>Opening invitation…</p> : error && !invitation ? <div className="memory-login-error">{error}</div> : invitation && <>
          <p className="memory-eyebrow">Invitation from {invitation.inviter_name}</p>
          <h2>Join {invitation.household_name}</h2>
          <p className="memory-login-copy">This invitation is for <strong>{invitation.email}</strong>.</p>
          {user ? <button type="button" className="memory-login-submit" onClick={acceptSignedIn} disabled={loading}>Accept invitation</button>
            : invitation.account_exists ? <button type="button" className="memory-login-submit" onClick={signInToAccept}>Sign in to accept</button>
              : <form onSubmit={createAccount}>
                <label>Your name<input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" required /></label>
                <label>Create a password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /><small>Use at least 12 characters.</small></label>
                <label>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
                {error && <div className="memory-login-error">{error}</div>}
                <button className="memory-login-submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account and join'}</button>
              </form>}
          {error && invitation && <div className="memory-login-error mt-3">{error}</div>}
        </>}
      </div></section>
    </main>
  );
}
