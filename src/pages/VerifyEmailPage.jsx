import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function VerifyEmailPage({ token }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.verifyEmail(token).then(result => setMessage(result.message)).catch(err => setError(err.message || 'This verification link could not be used.'));
  }, [token]);

  return <main className="memory-login">
    <section className="memory-login-story"><a className="memory-login-brand" href="/"><span className="memory-brand-mark">P</span><span>Postcards of Us</span></a><div><p className="memory-eyebrow">Email verification</p><h1>Keep your account reachable.</h1></div></section>
    <section className="memory-login-panel"><div className="memory-login-form"><h2>{message ? 'Email verified' : error ? 'Verification link unavailable' : 'Verifying your email…'}</h2>
      {message && <><div className="rounded-lg bg-green-50 p-3 text-green-800">{message}</div><a className="memory-login-submit mt-4 block text-center" href="/?login=1">Return to sign in</a></>}
      {error && <><div className="memory-login-error">{error}</div><a className="memory-login-submit mt-4 block text-center" href="/?login=1">Return to sign in</a></>}
    </div></section>
  </main>;
}
