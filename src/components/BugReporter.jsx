import React, { useEffect, useState } from 'react';
import { Bug, Check, Send, X } from 'lucide-react';
import api from '../utils/api';
import { APP_VERSION } from '../config/app';

const EMPTY_REPORT = { title: '', details: '' };

export default function BugReporter() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(EMPTY_REPORT);
  const [context, setContext] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');

  useEffect(() => () => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
  }, [screenshotPreview]);

  useEffect(() => {
    function handleOpen(event) {
      const detail = event.detail || {};
      setContext(detail);
      setReport({
        title: detail.title || 'Something went wrong',
        details: detail.details || '',
      });
      setError('');
      setSent(false);
      setScreenshot(null);
      setScreenshotPreview('');
      setOpen(true);
    }

    window.addEventListener('postcards-open-bug-reporter', handleOpen);
    return () => window.removeEventListener('postcards-open-bug-reporter', handleOpen);
  }, []);

  function close() {
    if (sending) return;
    setOpen(false);
  }

  function openBlank() {
    setContext(null);
    setReport(EMPTY_REPORT);
    setError('');
    setSent(false);
    setScreenshot(null);
    setScreenshotPreview('');
    setOpen(true);
  }

  function handleScreenshot(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Attach a PNG, JPG, or WebP screenshot.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshots must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    setError('');
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  function removeScreenshot() {
    setScreenshot(null);
    setScreenshotPreview('');
  }

  async function submit(event) {
    event.preventDefault();
    const title = report.title.trim();
    const details = report.details.trim();
    if (!title || !details) {
      setError('Add a short title and tell us what happened.');
      return;
    }

    setSending(true);
    setError('');
    try {
      await api.submitBugReport({
        title,
        details,
        screenshot,
        context: {
          ...context,
          page: window.location.pathname,
          url: window.location.href,
          appVersion: APP_VERSION,
          userAgent: navigator.userAgent,
        },
      });
      setSent(true);
    } catch (requestError) {
      setError(requestError.message || 'The bug report could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className="bug-reporter-trigger"
          onClick={openBlank}
          aria-label="Report a bug"
        >
          <Bug aria-hidden="true" />
          <span>Report a bug</span>
        </button>
      )}

      {open && (
        <div className="bug-reporter-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
          <section className="bug-reporter-modal" role="dialog" aria-modal="true" aria-labelledby="bug-reporter-title">
            <header className="bug-reporter-heading">
              <div>
                <p className="memory-eyebrow">Help us keep the pages smooth</p>
                <h2 id="bug-reporter-title">Report a bug</h2>
              </div>
              <button type="button" onClick={close} aria-label="Close bug report" className="bug-reporter-close">
                <X aria-hidden="true" />
              </button>
            </header>

            {sent ? (
              <div className="bug-reporter-success" role="status">
                <span className="bug-reporter-success-icon"><Check aria-hidden="true" /></span>
                <h3>Thanks for the report.</h3>
                <p>We saved the details and the technical context needed to investigate it.</p>
                <button type="button" onClick={close} className="bug-reporter-primary">Done</button>
              </div>
            ) : (
              <form onSubmit={submit} className="bug-reporter-form">
                <p className="bug-reporter-intro">A sentence or two is enough. Tell us what you expected and what happened instead.</p>
                <label>
                  <span>What went wrong?</span>
                  <input
                    type="text"
                    value={report.title}
                    maxLength={120}
                    onChange={event => setReport(current => ({ ...current, title: event.target.value }))}
                    placeholder="Could not save a new memory"
                    autoFocus
                  />
                </label>
                <label>
                  <span>Details</span>
                  <textarea
                    value={report.details}
                    maxLength={4000}
                    onChange={event => setReport(current => ({ ...current, details: event.target.value }))}
                    placeholder="I entered a location and date, then…"
                    rows={5}
                  />
                </label>
                <label>
                  <span>Screenshot <small>(optional)</small></span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleScreenshot}
                  />
                </label>
                {screenshotPreview && (
                  <div className="bug-reporter-screenshot-preview">
                    <img src={screenshotPreview} alt="Screenshot preview" />
                    <div>
                      <p>{screenshot.name}</p>
                      <button type="button" onClick={removeScreenshot}>Remove screenshot</button>
                    </div>
                  </div>
                )}
                {context?.requestId && (
                  <p className="bug-reporter-reference">Request reference: <code>{context.requestId}</code></p>
                )}
                {error && <p className="bug-reporter-error" role="alert">{error}</p>}
                <div className="bug-reporter-actions">
                  <button type="button" onClick={close} className="bug-reporter-secondary">Cancel</button>
                  <button type="submit" disabled={sending} className="bug-reporter-primary">
                    <Send aria-hidden="true" />
                    {sending ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
