import React, { useState } from 'react';
import api from '../utils/api';

export default function ResetPasswordPage({ token }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) return setError('The passwords do not match.');
    setLoading(true);
    try { setMessage((await api.resetPassword(token, password)).message); }
    catch (err) { setError(err.message || 'The password could not be reset.'); }
    finally { setLoading(false); }
  }

  return <main className="memory-login">
    <section className="memory-login-story"><a className="memory-login-brand" href="/"><span className="memory-brand-mark">P</span><span>Postcards of Us</span></a><div><p className="memory-eyebrow">Account recovery</p><h1>Choose a new key to your memories.</h1></div></section>
    <section className="memory-login-panel"><div className="memory-login-form"><h2>Set a new password</h2>
      {message ? <><div className="rounded-lg bg-green-50 p-3 text-green-800">{message}</div><a className="memory-login-submit mt-4 block text-center" href="/?login=1">Return to sign in</a></> : <form onSubmit={submit}>
        <label>New password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /><small>Use at least 12 characters.</small></label>
        <label>Confirm password<input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        {error && <div className="memory-login-error">{error}</div>}
        <button className="memory-login-submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button>
      </form>}
    </div></section>
  </main>;
}
