import React, { useEffect, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const RESPONSES = [
  'I knew exactly where to start',
  'I was not sure where to start',
  'Adding a memory took too long',
  'I wanted to do something else',
  'Something did not work',
];

function storageKey(userId) {
  return `postcards-beta-feedback-complete-${userId}`;
}

function hasCompletedFeedback(userId) {
  try { return localStorage.getItem(storageKey(userId)) === '1'; } catch { return false; }
}

function rememberFeedback(userId) {
  try { localStorage.setItem(storageKey(userId), '1'); } catch { /* The prompt still dismisses for this session. */ }
}

export default function BetaFeedbackPrompt({ memoryCount }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (memoryCount > 0 && user?.id && !hasCompletedFeedback(user.id)) setOpen(true);
  }, [memoryCount, user?.id]);

  function dismiss() {
    rememberFeedback(user.id);
    setOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (!selected || sending) return;
    setSending(true);
    setError('');
    try {
      await api.submitBetaFeedback(selected);
      rememberFeedback(user.id);
      setSent(true);
    } catch (requestError) {
      setError(requestError.message || 'Your answer could not be saved. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <section className="beta-feedback-card" aria-labelledby="beta-feedback-title">
      <div className="beta-feedback-heading">
        <span className="beta-feedback-icon" aria-hidden="true">{sent ? <Check /> : <MessageCircle />}</span>
        <div>
          <p className="dashboard-kicker">One quick beta question</p>
          <h2 id="beta-feedback-title">What almost stopped you today?</h2>
        </div>
        {!sent && <button type="button" className="beta-feedback-dismiss" onClick={dismiss} aria-label="Dismiss beta feedback"><X aria-hidden="true" /></button>}
      </div>

      {sent ? (
        <div className="beta-feedback-success" role="status">
          <p>Thank you. That helps us make the first memory easier for the next family.</p>
          <button type="button" className="beta-feedback-submit" onClick={() => setOpen(false)}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset className="beta-feedback-options">
            <legend className="sr-only">Choose the closest answer</legend>
            {RESPONSES.map(response => (
              <button
                key={response}
                type="button"
                className={`beta-feedback-option ${selected === response ? 'is-selected' : ''}`}
                aria-pressed={selected === response}
                onClick={() => setSelected(response)}
              >
                {response}
              </button>
            ))}
          </fieldset>
          {error && <p className="beta-feedback-error" role="alert">{error}</p>}
          <div className="beta-feedback-actions">
            <button type="submit" className="beta-feedback-submit" disabled={!selected || sending}>{sending ? 'Saving…' : 'Send answer'}</button>
            <button type="button" className="beta-feedback-later" onClick={dismiss}>Not now</button>
          </div>
        </form>
      )}
    </section>
  );
}
