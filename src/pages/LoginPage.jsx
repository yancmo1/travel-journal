import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(username, password, displayName);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message || 'We couldn’t sign you in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="memory-login">
      <section className="memory-login-story">
        <div className="memory-login-brand">
          <span className="memory-brand-mark" aria-hidden="true">P</span>
          <span>Postcards of Us</span>
        </div>
        <div>
          <p className="memory-eyebrow">A life traveled together</p>
          <h1>Every place left us with a story.</h1>
          <p>Come back to one today.</p>
        </div>
        <p className="memory-login-footnote">Private to your family.</p>
      </section>

      <section className="memory-login-panel">
        <div className="memory-login-form">
          <p className="memory-eyebrow">{isRegister ? 'Begin your journal' : 'Welcome back'}</p>
          <h2>{isRegister ? 'Create your account' : 'See today’s memory'}</h2>
          <p className="memory-login-copy">
            {isRegister
              ? 'Set this up once, then the two of you can start adding your travels.'
              : 'Sign in to return to your shared travel story.'}
          </p>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <label>
                Your name
                <input
                  type="text"
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                />
              </label>
            )}

            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder="Your username"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Your password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
            </label>

            {error && <div className="memory-login-error" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="memory-login-submit">
              {loading ? 'One moment…' : isRegister ? 'Create our journal' : 'Open our memories'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsRegister(value => !value);
              setError('');
            }}
            className="memory-login-switch"
          >
            {isRegister ? 'We already have an account' : 'Setting this up for the first time?'}
          </button>
        </div>
      </section>
    </main>
  );
}
