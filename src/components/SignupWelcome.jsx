import React, { useState } from 'react';
import { ArrowRight, Check, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function SignupWelcome({ onStart, onExplore }) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const verified = Boolean(user?.email_verified_at);

  async function resendVerification() {
    setSending(true);
    setMessage('');
    setError('');
    try {
      const result = await api.resendVerification();
      setMessage(result.message || 'A fresh verification link is on its way.');
    } catch (requestError) {
      setError(requestError.message || 'The verification email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="getting-started-page signup-welcome-page">
      <section className="getting-started-shell signup-welcome-shell" aria-labelledby="signup-welcome-title">
        <div className="getting-started-hero">
          <div className="getting-started-icon" aria-hidden="true"><ShieldCheck /></div>
          <div>
            <p className="memory-eyebrow">Welcome to Postcards of Us</p>
            <h1 id="signup-welcome-title">Your family story has a place to begin.</h1>
            <p>Start with one memory. You can add the people, places, and journeys around it whenever you’re ready.</p>
          </div>
        </div>

        <div className="signup-welcome-steps" aria-label="Your first three steps">
          <div><span>1</span><strong>Add one memory</strong><small>A place, moment, or photo is enough.</small></div>
          <div><span>2</span><strong>See your story take shape</strong><small>Find it on your map and timeline.</small></div>
          <div><span>3</span><strong>Invite your people</strong><small>Share when there’s something to show.</small></div>
        </div>

        <div className={`signup-welcome-verification ${verified ? 'is-verified' : ''}`} role="status">
          <span className="signup-welcome-verification-icon" aria-hidden="true">{verified ? <Check /> : <Mail />}</span>
          <div>
            <strong>{verified ? 'Your email is verified' : 'Check your email when you have a moment'}</strong>
            <p>{verified
              ? 'Your account is ready for recovery and family invitations.'
              : `We sent a verification link to ${user?.email || 'your email address'}. You can start exploring now; verifying keeps your account easy to recover.`}</p>
            {!verified && <button type="button" className="signup-welcome-resend" onClick={resendVerification} disabled={sending}>{sending ? 'Sending…' : 'Send it again'}</button>}
          </div>
        </div>

        {message && <p className="signup-welcome-message" role="status">{message}</p>}
        {error && <p className="signup-welcome-error" role="alert">{error}</p>}

        <div className="getting-started-actions signup-welcome-actions">
          <button type="button" className="getting-started-primary" onClick={onStart}>Add my first memory <ArrowRight aria-hidden="true" /></button>
          <button type="button" className="getting-started-secondary" onClick={onExplore}>I’ll explore on my own</button>
        </div>
      </section>
    </main>
  );
}
