import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function VerifyEmailPage({ token }) {
  const [status, setStatus] = useState({ loading: true, error: '', message: '' });
  useEffect(() => {
    api.verifyEmail(token)
      .then(result => setStatus({ loading: false, error: '', message: result.message }))
      .catch(error => setStatus({ loading: false, error: error.message, message: '' }));
  }, [token]);
  return <main className="memory-login"><section className="memory-login-story"><a className="memory-login-brand" href="/"><span className="memory-brand-mark">P</span><span>Postcards of Us</span></a><div><p className="memory-eyebrow">Secure account</p><h1>Your memories deserve a verified way home.</h1></div></section><section className="memory-login-panel"><div className="memory-login-form"><h2>Confirming your email</h2>{status.loading ? <p>One moment…</p> : status.error ? <div className="memory-login-error">{status.error}</div> : <div className="rounded-lg bg-green-50 p-3 text-green-800">{status.message}</div>}<a className="memory-login-submit mt-4 block text-center" href="/?login=1">Continue to sign in</a></div></section></main>;
}
