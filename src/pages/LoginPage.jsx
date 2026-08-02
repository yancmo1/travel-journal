import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const forgot = new URLSearchParams(window.location.search).get('forgot') === '1';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'We couldn’t sign you in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api.forgotPassword(username);
      setMessage(result.message);
    } catch (err) {
      setError(err.message || 'We couldn’t send a reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="memory-login">
      <section className="memory-login-story">
        <a className="memory-login-brand" href="/" aria-label="Postcards of Us home">
          <span className="memory-brand-mark" aria-hidden="true">P</span>
          <span>Postcards of Us</span>
        </a>
        <div>
          <p className="memory-eyebrow">A life traveled together</p>
          <h1>Every place left us with a story.</h1>
          <p>Come back to one today.</p>
        </div>
        <p className="memory-login-footnote">Private to your family.</p>
      </section>

      <section className="memory-login-panel">
        <div className="memory-login-form">
          <a className="memory-login-back" href="/"><span aria-hidden="true">←</span> Back to Postcards of Us</a>
          <p className="memory-eyebrow">{forgot ? 'Account recovery' : 'Welcome back'}</p>
          <h2>{forgot ? 'Reset your password' : 'Open your memories'}</h2>
          <p className="memory-login-copy">
            {forgot ? 'Enter the verified email on your account and we’ll send a secure, one-time reset link.' : 'Sign in to return to your private family travel story.'}
          </p>

          <form onSubmit={forgot ? handleForgot : handleSubmit}>
            <label>
              {forgot ? 'Email' : 'Email or legacy username'}
              <input
                type={forgot ? 'email' : 'text'}
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder={forgot ? 'you@example.com' : 'you@example.com'}
                autoComplete="username"
                required
              />
            </label>

            {!forgot && <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </label>}

            {error && <div className="memory-login-error" role="alert">{error}</div>}
            {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{message}</div>}

            <button type="submit" disabled={loading} className="memory-login-submit">
              {loading ? 'One moment…' : forgot ? 'Send reset link' : 'Open our memories'}
            </button>
          </form>

          <p className="memory-login-invite">
            {forgot ? <a href="/?login=1">Back to sign in</a> : <><a href="/?login=1&amp;forgot=1">Forgot password?</a><br />Postcards of Us is currently invitation-only.</>}
          </p>
        </div>
      </section>
    </main>
  );
}
