import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Lock, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { nominatimSearch } from '../utils/geocoding';

const DISMISSED_KEY = 'postcards-home-onboarding-dismissed';

export default function HomeBaseOnboarding() {
  const { user, updateHome } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!user || user.home_latitude != null) return;
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    if (!dismissed.includes(user.id)) setOpen(true);
  }, [user]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function dismiss() {
    if (user) {
      const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...dismissed, user.id])]));
    }
    setOpen(false);
  }

  function handleQueryChange(value) {
    setQuery(value);
    setSelected(null);
    setError('');
    clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setResults(await nominatimSearch(value));
      } catch {
        setResults([]);
      }
    }, 350);
  }

  function pickResult(result) {
    const address = result.address || {};
    if (!(address.city || address.town || address.village || address.postcode)) {
      setError('Try adding a city or zip code so we can place your home.');
      return;
    }
    setSelected(result);
    setQuery(result.display_name);
    setResults([]);
    setError('');
  }

  async function saveHome() {
    if (!selected) {
      setError('Choose a place from the suggestions to continue.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateHome({
        homeLatitude: selected.lat,
        homeLongitude: selected.lng,
        homeLabel: selected.display_name,
        homeIcon: user?.home_icon || 'h',
      });
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Your home base could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="home-onboarding-backdrop" role="presentation">
      <section className="home-onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="home-onboarding-title">
        <button type="button" className="home-onboarding-close" onClick={dismiss} aria-label="Set home later">
          <X aria-hidden="true" />
        </button>
        <div className="home-onboarding-mark" aria-hidden="true"><MapPin /></div>
        <p className="memory-eyebrow">A small first step</p>
        <h2 id="home-onboarding-title">Where is home?</h2>
        <p className="home-onboarding-lede">
          Your home base gives the atlas a starting point and helps show how far your family has traveled.
        </p>

        <div className="home-onboarding-field">
          <label htmlFor="home-onboarding-address">Home address</label>
          <div className="home-onboarding-input-wrap">
            <MapPin aria-hidden="true" />
            <input
              id="home-onboarding-address"
              type="text"
              value={query}
              onChange={event => handleQueryChange(event.target.value)}
              onBlur={() => setTimeout(() => setResults([]), 150)}
              placeholder="Street address, city, or zip code"
              autoComplete="street-address"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="home-onboarding-results" role="listbox" aria-label="Home address suggestions">
              {results.map((result, index) => (
                <button key={`${result.lat}-${result.lng}-${index}`} type="button" role="option" onMouseDown={() => pickResult(result)}>
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="home-onboarding-privacy"><Lock aria-hidden="true" /> This stays private to your family site.</p>
        {error && <p className="home-onboarding-error" role="alert">{error}</p>}

        <div className="home-onboarding-actions">
          <button type="button" className="home-onboarding-primary" onClick={saveHome} disabled={saving}>
            {saving ? 'Saving…' : 'Set my home base'} <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="home-onboarding-later" onClick={dismiss}>I’ll do this later</button>
        </div>
      </section>
    </div>
  );
}
