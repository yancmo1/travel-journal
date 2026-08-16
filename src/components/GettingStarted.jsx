import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Compass, HelpCircle, Image, MapPin, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import api from '../utils/api';
import { nominatimSearch } from '../utils/geocoding';
import TripForm from './TripForm';
import JourneyForm from './JourneyForm';

const STEPS = [
  ['home', 'Set your home base', 'Tell us where home is so we can show distance traveled. A city or ZIP code is fine.'],
  ['people', 'Add your people', 'Add the people who belong in your travel stories.'],
  ['memory', 'Add a memory', 'Save one place or moment from your travels.'],
  ['journey', 'Create a journey', 'Bring related memories together into one travel story.'],
];

export default function GettingStarted({ page = false, onNavigate }) {
  const { user, updateHome } = useAuth();
  const { trips, journeys, travelers, addTraveler } = useData();
  const [progress, setProgress] = useState(null);
  const [open, setOpen] = useState(page);
  const [stage, setStage] = useState('welcome');
  const [working, setWorking] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [person, setPerson] = useState({ name: '', relationship: 'other' });
  const [peopleError, setPeopleError] = useState('');
  const [savingPerson, setSavingPerson] = useState(false);
  const timer = useRef(null);

  async function loadProgress() {
    try {
      const next = await api.getOnboarding();
      setProgress(next);
      if (next.completed) setStage('complete');
      else if (next.home.complete && next.people?.complete && next.memory.complete) setStage('journey');
      else if (next.home.complete && next.people?.complete) setStage('memory');
      else if (next.home.complete) setStage('people');
      else setStage(next.welcomeSeen ? 'home' : 'welcome');
    } catch { /* The app remains usable if onboarding status is temporarily unavailable. */ }
  }

  useEffect(() => { if (user) loadProgress(); }, [user?.id, user?.home_latitude, user?.home_longitude]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    function reopen() { setOpen(true); setStage(progress?.completed ? 'complete' : (progress?.home?.complete ? (progress?.people?.complete ? (progress?.memory?.complete ? 'journey' : 'memory') : 'people') : 'home')); }
    window.addEventListener('postcards-open-getting-started', reopen);
    return () => window.removeEventListener('postcards-open-getting-started', reopen);
  }, [progress]);
  useEffect(() => {
    if (page) setOpen(true);
    else if (progress && !progress.welcomeSeen && !progress.completed) setOpen(true);
  }, [page, progress]);

  const currentStep = useMemo(() => STEPS.find(([id]) => id === stage), [stage]);
  const memory = progress?.memory?.id ? trips.find(item => Number(item.id) === Number(progress.memory.id)) : trips[0];
  const journey = progress?.journey?.id ? journeys.find(item => Number(item.id) === Number(progress.journey.id)) : journeys[0];

  async function mark(step, data = {}) {
    setWorking(true);
    try { await api.updateOnboarding(step, data); await loadProgress(); }
    finally { setWorking(false); }
  }

  function closeGuide() {
    if (page) onNavigate?.('dashboard');
    else setOpen(false);
  }

  function dismissWelcome() { mark('welcome').catch(() => {}); closeGuide(); }

  function skipStep() {
    if (stage === 'home') mark('home', { status: 'skipped' }).catch(() => {});
    if (stage === 'people') mark('people', { status: 'skipped' }).catch(() => {});
    closeGuide();
  }

  function handleQuery(value) {
    setQuery(value); setSelected(null); setError(''); clearTimeout(timer.current);
    if (value.trim().length < 3) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try { setResults(await api.searchPlaces(value)); }
      catch { try { setResults(await nominatimSearch(value)); } catch { setResults([]); } }
    }, 300);
  }

  async function saveHome() {
    if (!selected) { setError('Choose a city or ZIP code from the suggestions.'); return; }
    setWorking(true); setError('');
    try {
      await updateHome({ homeLatitude: selected.lat, homeLongitude: selected.lng, homeLabel: selected.display_name, homeIcon: user?.home_icon || 'h' });
      await mark('home');
    } catch (requestError) { setError(requestError.message || 'Your home base could not be saved.'); setWorking(false); }
  }

  function onMemorySaved(saved) {
    setShowMemory(false);
    mark('memory', { memoryId: saved?.id }).catch(() => {});
  }

  function onJourneySaved(saved) {
    setShowJourney(false);
    mark('journey', { journeyId: saved?.id }).then(() => {
      setStage('complete');
      window.dispatchEvent(new Event('postcards-onboarding-completed'));
      if (!page) closeGuide();
    }).catch(() => {});
  }

  async function savePerson(event) {
    event.preventDefault();
    if (!person.name.trim()) { setPeopleError('Enter a name to add a person.'); return; }
    setSavingPerson(true); setPeopleError('');
    try {
      await addTraveler({ name: person.name.trim(), relationship: person.relationship });
      setPerson({ name: '', relationship: 'other' });
      await mark('people');
    } catch (requestError) {
      setPeopleError(requestError.message || 'That person could not be added.');
    } finally { setSavingPerson(false); }
  }

  if (!page && !open) return null;

  const shell = (
    <section className="getting-started-shell" role="dialog" aria-modal={!page} aria-labelledby="getting-started-title">
      {!page && <button type="button" className="getting-started-close" onClick={() => setOpen(false)} aria-label="Close Getting Started"><X /></button>}
      <div className="getting-started-hero">
        <div className="getting-started-icon" aria-hidden="true"><Compass /></div>
        <div>
          <p className="memory-eyebrow">Getting started</p>
          <h1 id="getting-started-title">Let’s set up your travel story</h1>
          <p>We’ll take it one small step at a time. You can skip anything and come back whenever you’re ready.</p>
        </div>
      </div>

      <div className="getting-started-checklist" aria-label="Getting started checklist">
        {STEPS.map(([id, title]) => {
          const complete = progress?.[id]?.complete;
          return <div key={id} className={`getting-started-check ${complete ? 'is-complete' : ''}`}><span>{complete ? <Check aria-hidden="true" /> : STEPS.findIndex(step => step[0] === id) + 1}</span><strong>{title}</strong></div>;
        })}
      </div>

      {stage === 'welcome' && (
        <div className="getting-started-step">
          <h2>Three simple steps</h2>
          <p>A <strong>memory</strong> is one place or moment from your travels. A <strong>journey</strong> brings related memories together into one travel story.</p>
          <div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={() => { mark('welcome'); setStage(progress?.home?.complete ? 'people' : 'home'); }}>Start here <ArrowRight aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={() => { mark('welcome'); setStage('sample'); }}>Try a sample</button><button type="button" className="getting-started-secondary" onClick={dismissWelcome}>I’ll explore on my own</button></div>
        </div>
      )}

      {stage === 'sample' && (
        <div className="getting-started-step">
          <h2>Here’s how the pieces fit</h2>
          <p>This sample is only a preview. It will not be added to your memory site.</p>
          <div className="getting-started-sample">
            <div><span>Memory</span><strong>Golden Gate Bridge</strong><small>San Francisco · October 2023</small></div>
            <ArrowRight aria-hidden="true" />
            <div><span>Journey</span><strong>California road trip</strong><small>Several memories from one trip</small></div>
          </div>
          <div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={() => { setStage(progress?.home?.complete ? 'people' : 'home'); }}>Use my own memory <ArrowRight aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={() => setStage('welcome')}>Back</button></div>
        </div>
      )}

      {stage === 'home' && (
        <div className="getting-started-step">
          <h2>Where is home?</h2><p>Your home base helps us show how far you have traveled. It stays private to your family site. An exact address is not needed — a city or ZIP code is perfect.</p>
          <label className="getting-started-label" htmlFor="getting-started-home">City or ZIP code</label>
          <div className="getting-started-input"><MapPin aria-hidden="true" /><input id="getting-started-home" value={query} onChange={event => handleQuery(event.target.value)} placeholder="Example: 73102 or Oklahoma City" autoFocus /></div>
          {results.length > 0 && <div className="getting-started-results" role="listbox">{results.map((result, index) => <button key={`${result.lat}-${result.lng}-${index}`} type="button" role="option" onMouseDown={() => { setSelected(result); setQuery(result.display_name); setResults([]); }}>{result.display_name}</button>)}</div>}
          {error && <p className="getting-started-error" role="alert">{error}</p>}
          <div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={saveHome} disabled={working}>{working ? 'Saving…' : 'Set my home base'} <ArrowRight aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={skipStep}>I’ll do this later</button></div>
        </div>
      )}

      {stage === 'people' && (
        <div className="getting-started-step">
          <h2>Who belongs in your story?</h2>
          <p>Add the people you travel with. They will appear in your memory form so you can connect each memory to the right people.</p>
          {travelers.length > 0 && <div className="getting-started-people-list" aria-label="People already added">{travelers.map(item => <span key={item.id}><Users aria-hidden="true" />{item.name}</span>)}</div>}
          <form className="getting-started-person-form" onSubmit={savePerson}>
            <label className="getting-started-label" htmlFor="getting-started-person">Person’s name</label>
            <div className="getting-started-person-fields"><input id="getting-started-person" value={person.name} onChange={event => setPerson(current => ({ ...current, name: event.target.value }))} placeholder="Example: Amber" autoFocus /><select value={person.relationship} onChange={event => setPerson(current => ({ ...current, relationship: event.target.value }))}><option value="husband">Partner</option><option value="wife">Partner</option><option value="child">Child</option><option value="grandchild">Grandchild</option><option value="other">Other</option></select><button type="submit" className="getting-started-primary" disabled={savingPerson}><UserPlus aria-hidden="true" />{savingPerson ? 'Adding…' : 'Add person'}</button></div>
          </form>
          {peopleError && <p className="getting-started-error" role="alert">{peopleError}</p>}
          <div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={() => setStage('memory')} disabled={!travelers.length}>Continue to memory <ArrowRight aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={skipStep}>I’ll do this later</button></div>
        </div>
      )}

      {stage === 'memory' && <div className="getting-started-step"><h2>Add your first memory</h2><p>A memory is one place or moment. Add a location, an approximate date, and one photo if you have it. We’ll look at the photo for date and location details first, and you can choose whether to apply them.</p><div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={() => setShowMemory(true)}>Add a memory <Image aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={skipStep}>I’ll do this later</button></div></div>}
      {stage === 'journey' && <div className="getting-started-step"><h2>Bring your memory into a journey</h2><p>A journey is the story of one trip. We’ll start with your new memory already selected.</p><div className="getting-started-actions"><button type="button" className="getting-started-primary" onClick={() => setShowJourney(true)}>Create a journey <ArrowRight aria-hidden="true" /></button><button type="button" className="getting-started-secondary" onClick={skipStep}>I’ll do this later</button></div></div>}
      {stage === 'complete' && <div className="getting-started-step"><h2>Your first travel story is ready</h2><p>You now have a person, a memory, and a journey. Getting Started is complete. You can reopen this page anytime from Settings.</p><div className="getting-started-actions getting-started-actions-wrap"><button type="button" className="getting-started-primary" onClick={() => { closeGuide(); onNavigate?.('trips'); }}>Edit your memory</button><button type="button" className="getting-started-secondary" onClick={() => { closeGuide(); onNavigate?.('trips'); }}>Add another memory</button><button type="button" className="getting-started-secondary" onClick={() => { closeGuide(); onNavigate?.('dashboard'); }}>Explore the map</button></div></div>}

      {currentStep && stage !== 'welcome' && stage !== 'complete' && <p className="getting-started-footnote"><HelpCircle aria-hidden="true" /> You can reopen this guide from the Getting Started link anytime.</p>}
    </section>
  );

  return <>{page ? <main className="getting-started-page">{shell}</main> : <div className="getting-started-backdrop">{shell}</div>}{showMemory && <TripForm onboardingMode onClose={() => setShowMemory(false)} onSaved={onMemorySaved} />}{showJourney && <JourneyForm initialMemoryIds={memory?.id ? [memory.id] : []} onClose={() => setShowJourney(false)} onSaved={onJourneySaved} />}</>;
}
