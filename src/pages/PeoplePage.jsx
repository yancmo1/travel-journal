import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { sortTravelers } from '../utils/travelers';

const RELATIONSHIPS = [
  ['husband', 'Husband'],
  ['wife', 'Wife'],
  ['child', 'Child'],
  ['grandchild', 'Grandkid'],
  ['other', 'Other'],
];

function relationshipLabel(value) {
  return RELATIONSHIPS.find(([id]) => id === value)?.[1] || 'Other';
}

function emptyDraft() {
  return { name: '', relationship: 'other' };
}

export default function PeoplePage({ setPage, setTravelerFilter }) {
  const { travelers, trips, addTraveler, updateTraveler, deleteTraveler, loadTravelers } = useData();
  const [newPerson, setNewPerson] = useState(emptyDraft);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingNew, setSavingNew] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(current => Object.fromEntries(
      travelers.map(person => [person.id, current[person.id] || {
        name: person.name,
        relationship: person.relationship || 'other',
      }])
    ));
  }, [travelers]);

  const memoryCounts = useMemo(() => {
    const counts = new Map();
    trips.forEach(trip => {
      (trip.travelers || []).forEach(person => {
        counts.set(person.id, (counts.get(person.id) || 0) + 1);
      });
    });
    return counts;
  }, [trips]);

  const activePeople = sortTravelers(travelers.filter(person => person.is_active !== false));
  const inactivePeople = sortTravelers(travelers.filter(person => person.is_active === false));

  function updateDraft(id, field, value) {
    setDrafts(current => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  async function savePerson(person) {
    const draft = drafts[person.id];
    if (!draft?.name.trim()) return;

    setSavingId(person.id);
    setMessage('');
    setError('');
    try {
      await updateTraveler(person.id, {
        name: draft.name.trim(),
        relationship: draft.relationship,
        isActive: person.is_active !== false,
      });
      setMessage(`${draft.name.trim()} was updated.`);
    } catch (err) {
      setError(err.message || 'That person could not be updated.');
    } finally {
      setSavingId(null);
    }
  }

  async function setActive(person, isActive) {
    setSavingId(person.id);
    setMessage('');
    setError('');
    try {
      await updateTraveler(person.id, {
        isActive,
        name: person.name,
        relationship: person.relationship,
      });
      setMessage(`${person.name} is now ${isActive ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err.message || 'That person could not be updated.');
    } finally {
      setSavingId(null);
    }
  }

  async function removePerson(person) {
    const count = memoryCounts.get(person.id) || 0;
    const memoryNote = count > 0
      ? ` This will remove ${count} ${count === 1 ? 'memory association' : 'memory associations'} but will not delete the memories themselves.`
      : '';
    if (!window.confirm(`Delete ${person.name}?${memoryNote} This cannot be undone.`)) return;

    setSavingId(person.id);
    setMessage('');
    setError('');
    try {
      await deleteTraveler(person.id);
      setMessage(`${person.name} was deleted.`);
    } catch (err) {
      setError(err.message || 'That person could not be deleted.');
      await loadTravelers({ includeInactive: true });
    } finally {
      setSavingId(null);
    }
  }

  async function createPerson(event) {
    event.preventDefault();
    if (!newPerson.name.trim()) return;

    setSavingNew(true);
    setMessage('');
    setError('');
    try {
      await addTraveler({
        name: newPerson.name.trim(),
        relationship: newPerson.relationship,
      });
      setNewPerson(emptyDraft());
      setMessage('Person added.');
    } catch (err) {
      setError(err.message || 'That person could not be added.');
    } finally {
      setSavingNew(false);
    }
  }

  async function refreshPeople() {
    await loadTravelers({ includeInactive: true });
    setMessage('People refreshed.');
  }

  function renderPersonCard(person) {
    const draft = drafts[person.id] || { name: person.name, relationship: person.relationship || 'other' };
    const isActive = person.is_active !== false;
    const count = memoryCounts.get(person.id) || 0;

    function viewMemories() {
      setTravelerFilter(String(person.id));
      setPage('trips');
    }

    return (
      <article key={person.id} className={`people-card bg-white rounded-2xl border p-5 shadow-sm ${isActive ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-85'}`}>
        <div className="people-card-header flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">{isActive ? 'Active person' : 'Inactive person'}</p>
            <p className="mt-1 text-sm text-gray-500">{count} {count === 1 ? 'memory' : 'memories'}</p>
          </div>
          <span className="rounded-full bg-ocean-teal/10 px-3 py-1 text-xs font-semibold text-ocean-teal">
            {relationshipLabel(draft.relationship)}
          </span>
        </div>

        <div className="people-card-fields space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input
              value={draft.name}
              onChange={event => updateDraft(person.id, 'name', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:border-transparent focus:ring-2 focus:ring-ocean-teal"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Relationship
            <select
              value={draft.relationship}
              onChange={event => updateDraft(person.id, 'relationship', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-ocean-teal"
            >
              {RELATIONSHIPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="people-card-actions mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => savePerson(person)}
            disabled={savingId === person.id || !draft.name.trim()}
            className="rounded-lg bg-ocean-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingId === person.id ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => setActive(person, !isActive)}
            disabled={savingId === person.id}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-ocean-teal hover:text-ocean-dark disabled:opacity-50"
          >
            {isActive ? 'Deactivate' : 'Reactivate'}
          </button>
          <button
            type="button"
            onClick={viewMemories}
            className="rounded-lg border border-ocean-teal/30 px-4 py-2 text-sm font-semibold text-ocean-dark transition hover:border-ocean-teal hover:bg-ocean-teal/5"
          >
            View memories
          </button>
          <button
            type="button"
            onClick={() => removePerson(person)}
            disabled={savingId === person.id}
            className="people-delete-button rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" />
            Delete
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="settings-people mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sunset-orange">Family manager</p>
          <h1 className="mt-2 text-3xl font-semibold text-ocean-dark sm:text-4xl">The people in our stories</h1>
          <p className="mt-2 max-w-2xl text-gray-600">Keep names and relationships tidy in one place. Deactivating someone preserves their older memories while keeping them out of new memory forms.</p>
        </div>
        <button type="button" onClick={refreshPeople} className="self-start rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-ocean-teal hover:text-ocean-dark">Refresh people</button>
      </div>

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`} role="status">
          {error || message}
        </div>
      )}

      <form onSubmit={createPerson} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-ocean-dark">Add someone</h2>
          <p className="mt-1 text-sm text-gray-500">They’ll be available when you add the next memory.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input
              value={newPerson.name}
              onChange={event => setNewPerson(current => ({ ...current, name: event.target.value }))}
              placeholder="For example, Grandma Jo"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:border-transparent focus:ring-2 focus:ring-ocean-teal"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Relationship
            <select
              value={newPerson.relationship}
              onChange={event => setNewPerson(current => ({ ...current, relationship: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-ocean-teal"
            >
              {RELATIONSHIPS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={savingNew || !newPerson.name.trim()} className="rounded-lg bg-sunset-orange px-5 py-2.5 font-semibold text-white transition hover:bg-coral-pink disabled:cursor-not-allowed disabled:opacity-50">
            {savingNew ? 'Adding…' : 'Add person'}
          </button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ocean-dark">Active people</h2>
            <p className="text-sm text-gray-500">{activePeople.length} available for new memories.</p>
          </div>
        </div>
        {activePeople.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">{activePeople.map(renderPersonCard)}</div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">Add your first person above.</div>
        )}
      </section>

      {inactivePeople.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-ocean-dark">Inactive people</h2>
            <p className="text-sm text-gray-500">Older memories stay connected. Reactivate someone whenever you need them for a new memory.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{inactivePeople.map(renderPersonCard)}</div>
        </section>
      )}
    </div>
  );
}
