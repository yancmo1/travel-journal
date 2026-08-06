import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DataBackupPanel from '../components/DataBackupPanel';
import CleanupPage from './CleanupPage';
import PeoplePage from './PeoplePage';
import { APP_VERSION } from '../config/app';
import AccountAccessPanel from '../components/AccountAccessPanel';
import { useAuth } from '../context/AuthContext';
import { HOME_ICONS, HOME_ICON_IDS, homeBadgeHtml } from '../utils/homeIcons';
import { nominatimSearch } from '../utils/geocoding';

const SECTIONS = [
  { id: 'overview', label: 'Settings', description: 'Your data and app details', icon: '⚙' },
  { id: 'people', label: 'People', description: 'Manage family members and relationships', icon: '♧' },
  { id: 'access', label: 'Family access', description: 'Accounts, invitations, and memory sites', icon: '◇' },
  { id: 'cleanup', label: 'Clean up', description: 'Review incomplete or duplicate memories', icon: '✓' },
];

export default function SettingsPage({ setPage, setTravelerFilter }) {
  const [section, setSection] = useState('overview');
  const settingsNavRef = useRef(null);
  const [settingsScroll, setSettingsScroll] = useState({ canScroll: false, atEnd: false });

  useEffect(() => {
    const nav = settingsNavRef.current;
    if (!nav) return undefined;

    function updateScrollState() {
      const maxScroll = nav.scrollWidth - nav.clientWidth;
      setSettingsScroll({
        canScroll: maxScroll > 4,
        atEnd: maxScroll > 4 && nav.scrollLeft >= maxScroll - 4,
      });
    }

    updateScrollState();
    nav.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      nav.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  function moveSettingsSections() {
    const nav = settingsNavRef.current;
    if (!nav) return;

    nav.scrollBy({
      left: settingsScroll.atEnd ? -Math.max(nav.clientWidth * .75, 120) : Math.max(nav.clientWidth * .75, 120),
      behavior: 'smooth',
    });
  }

  return (
    <div className="settings-layout">
      <header className="settings-heading">
        <div>
          <p className="memory-eyebrow">The practical side of our story</p>
          <h1>Settings</h1>
          <p>Keep your account, family details, and data tools together.</p>
        </div>
      </header>

      <div className="settings-grid">
        <div className="settings-sidebar-wrap">
          <aside ref={settingsNavRef} className="settings-sidebar" aria-label="Settings sections">
            {SECTIONS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                title={item.description}
                className={section === item.id ? 'is-active' : ''}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <span className="settings-sidebar-icon" aria-hidden="true">{item.icon}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </aside>
          <button
            type="button"
            className={`settings-sidebar-more ${settingsScroll.canScroll ? 'is-visible' : ''}`}
            onClick={moveSettingsSections}
            aria-label={settingsScroll.atEnd ? 'Show previous settings sections' : 'Show more settings sections'}
            title={settingsScroll.atEnd ? 'Show previous settings sections' : 'Show more settings sections'}
          >
            {settingsScroll.atEnd
              ? <ChevronLeft aria-hidden="true" />
              : <ChevronRight aria-hidden="true" />}
          </button>
        </div>

        <main className="settings-content">
          {section === 'overview' && <SettingsOverview />}
          {section === 'people' && (
            <PeoplePage setPage={setPage} setTravelerFilter={setTravelerFilter} />
          )}
          {section === 'access' && <AccountAccessPanel />}
          {section === 'cleanup' && <CleanupPage />}
        </main>
      </div>
    </div>
  );
}

function SettingsOverview() {
  return (
    <div className="settings-overview space-y-6">
      <HomeBaseCard />

      <DataBackupPanel />

      <section className="settings-about-card rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="memory-eyebrow">About this app</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ocean-dark">Postcards of Us</h2>
            <p className="mt-1 text-sm text-gray-600">Private family travel memories, available offline.</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">App version</p>
            <p className="mt-1 font-mono text-sm font-semibold text-ocean-dark">v{APP_VERSION}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function HomeBaseCard() {
  const { user, updateHome } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [icon, setIcon] = useState(user?.home_icon || 'h');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const searchTimer = useRef(null);

  const hasHome = user?.home_latitude != null;

  // Prefill from the user's saved home base.
  useEffect(() => {
    if (user?.home_label) setQuery(user.home_label);
    if (user?.home_latitude != null && user?.home_longitude != null) {
      setSelected({
        label: user.home_label || 'Home',
        lat: Number(user.home_latitude),
        lng: Number(user.home_longitude),
      });
    } else {
      setSelected(null);
    }
    if (user?.home_icon) setIcon(user.home_icon);
  }, [user?.home_label, user?.home_latitude, user?.home_longitude, user?.home_icon]);

  async function searchPlaces(value) {
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    try {
      const found = await nominatimSearch(q);
      setResults(found);
    } catch {
      setResults([]);
    }
  }

  function handleQueryChange(value) {
    setQuery(value);
    setSelected(null);
    setSaved(false);
    setError('');
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchPlaces(value), 350);
  }

  function hasCityOrZip(result) {
    const address = result.address || {};
    return !!(address.city || address.town || address.village || address.postcode);
  }

  function pickResult(result) {
    if (!hasCityOrZip(result)) {
      setError('We need at least a city or zip code so we can place your home. Try adding your city or zip.');
      return;
    }
    setSelected({ label: result.display_name, lat: result.lat, lng: result.lng });
    setQuery(result.display_name);
    setResults([]);
    setSaved(false);
    setError('');
  }

  async function handleSave() {
    if (!selected) {
      setError('Pick a place from the suggestions (a city or zip code is required).');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateHome({
        homeLatitude: selected.lat,
        homeLongitude: selected.lng,
        homeLabel: selected.label,
        homeIcon: icon,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Your home base could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateHome({ homeLatitude: null, homeLongitude: null, homeLabel: null, homeIcon: 'h' });
      setQuery('');
      setSelected(null);
      setIcon('h');
    } catch (err) {
      setError(err.message || 'Your home base could not be cleared. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="memory-eyebrow">Home base</p>
      <div className="mt-3">
        <h2 className="text-xl font-semibold text-ocean-dark">Where is home?</h2>
        <p className="mt-1 text-sm text-gray-600">
          This pins the home marker on your map. A full street address places it exactly; a city or
          zip code gets you close. We need at least a city or zip code.
        </p>
      </div>

      <div className="mt-4 relative">
        <label htmlFor="home-address" className="text-sm font-medium text-gray-700">Home address</label>
        <input
          id="home-address"
          type="text"
          value={query}
          onChange={event => handleQueryChange(event.target.value)}
          onBlur={() => setTimeout(() => setResults([]), 150)}
          placeholder="e.g. 123 Main St, Edmond, OK 73003  or  73112"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-ocean-teal focus:outline-none focus:ring-2 focus:ring-ocean-teal/20"
          autoComplete="off"
        />
        {results.length > 0 && (
          <div className="mt-2 absolute z-20 w-full rounded-lg border border-gray-100 bg-white shadow-xl overflow-hidden" role="listbox" aria-label="Home address suggestions">
            {results.map((result, index) => (
              <button
                key={`${result.lat}-${result.lng}-${index}`}
                type="button"
                role="option"
                onMouseDown={() => pickResult(result)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 border-b last:border-b-0"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasHome && !saved && !error && (
        <p className="mt-2 text-sm text-gray-500">
          Currently set to: <span className="font-medium text-gray-700">{user.home_label || 'Home'}</span>
        </p>
      )}
      {saved && <p className="mt-2 text-sm text-emerald-600" role="status">Home base saved — your map marker now points here.</p>}
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700">Marker style</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {HOME_ICON_IDS.map(iconId => {
            const option = HOME_ICONS[iconId];
            const isActive = icon === iconId;
            return (
              <button
                key={iconId}
                type="button"
                onClick={() => { setIcon(iconId); setSaved(false); }}
                aria-pressed={isActive}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  isActive ? 'border-ocean-teal bg-ocean-teal/10 text-ocean-dark' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span dangerouslySetInnerHTML={{ __html: homeBadgeHtml(iconId) }} />
                <span>{option.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-ocean-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save home base'}
        </button>
        {hasHome && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Remove home base
          </button>
        )}
      </div>
    </section>
  );
}
