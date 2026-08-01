import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          <p className="memory-eyebrow">Welcome back</p>
          <h2>Open your memories</h2>
          <p className="memory-login-copy">
            Sign in to return to your private family travel story.
          </p>

          <form onSubmit={handleSubmit}>
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
                autoComplete="current-password"
                required
              />
            </label>

            {error && <div className="memory-login-error" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="memory-login-submit">
              {loading ? 'One moment…' : 'Open our memories'}
            </button>
          </form>

          <p className="memory-login-invite">Postcards of Us is currently invitation-only.</p>
        </div>
      </section>
    </main>
  );
}
