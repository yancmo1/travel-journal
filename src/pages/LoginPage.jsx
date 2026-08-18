import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import logo from '../../assets/postcards-of-us-logo.png';
import travelPaperBackground from '../../assets/travel-paper-background.webp';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const forgot = new URLSearchParams(window.location.search).get('forgot') === '1';
  const signup = new URLSearchParams(window.location.search).get('signup') === '1';
  const [displayName, setDisplayName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (signup) await register(email, password, displayName);
      else await login(email, password);
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
      const result = await api.forgotPassword(email);
      setMessage(result.message);
    } catch (err) {
      setError(err.message || 'We couldn’t send a reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="memory-login" style={{ '--login-paper-art': `url(${travelPaperBackground})` }}>
      <section className="memory-login-story">
        <a className="memory-login-brand" href="/" aria-label="Postcards of Us home">
          <span className="memory-login-stamp"><img src={logo} alt="Postcards of Us" width="1254" height="1584" /></span>
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
          <p className="memory-eyebrow">{forgot ? 'Account recovery' : signup ? 'Start for free' : 'Welcome back'}</p>
          <h2>{forgot ? 'Reset your password' : signup ? 'Begin your family story' : 'Open your memories'}</h2>
          <p className="memory-login-copy">
            {forgot ? 'Enter the email on your account and we’ll send a secure, one-time reset link.' : signup ? 'Create a private Free account and make your first journey.' : 'Sign in to return to your private family travel story.'}
          </p>

          <form onSubmit={forgot ? handleForgot : handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            {signup && <label>
              Your name
              <input
                type="text"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </label>}

            {!forgot && <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Your password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
            />
              {signup && <small>Use at least 12 characters.</small>}
            </label>}

            {error && <div className="memory-login-error" role="alert">{error}</div>}
            {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{message}</div>}

            <button type="submit" disabled={loading} className="memory-login-submit">
              {loading ? 'One moment…' : forgot ? 'Send reset link' : signup ? 'Create Free account' : 'Open our memories'}
            </button>
          </form>

          <p className="memory-login-invite">
            {forgot ? <a href="/?login=1">Back to sign in</a> : signup
              ? <>Already have an account? <a href="/?login=1">Sign in</a></>
              : <><a href="/?login=1&amp;forgot=1">Forgot password?</a><br /><a href="/?login=1&amp;signup=1">Start a Free account</a></>}
          </p>
        </div>
      </section>
    </main>
  );
}
