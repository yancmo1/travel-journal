import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { useData } from '../context/DataContext';
import { sortTravelers } from '../utils/travelers';

const RELATIONSHIPS = [
  ['self', 'Self'],
  ['partner', 'Spouse / Partner'],
  ['child', 'Child'],
  ['parent', 'Parent'],
  ['sibling', 'Sibling'],
  ['friend', 'Friend'],
  ['other', 'Other'],
];

const GROUP_DEFINITIONS = [
  { key: 'self', label: 'Self', relationships: ['self'] },
  { key: 'partners', label: 'Spouse / Partner', relationships: ['partner', 'husband', 'wife'] },
  { key: 'children', label: 'Children', relationships: ['child', 'grandchild'] },
  { key: 'parents', label: 'Parents', relationships: ['parent'] },
  { key: 'siblings', label: 'Siblings', relationships: ['sibling'] },
  { key: 'friends', label: 'Friends', relationships: ['friend'] },
  { key: 'other', label: 'Other', relationships: ['other'] },
];

function relationshipLabel(value) {
  const labels = { self: 'Self', partner: 'Spouse / Partner', husband: 'Spouse / Partner', wife: 'Spouse / Partner', child: 'Child', grandchild: 'Child', parent: 'Parent', sibling: 'Sibling', friend: 'Friend', other: 'Other' };
  return labels[value] || 'Other';
}

function canonicalRelationship(value) {
  if (value === 'husband' || value === 'wife') return 'partner';
  if (value === 'grandchild') return 'child';
  return value || 'other';
}

function relationshipGroup(value) {
  return GROUP_DEFINITIONS.find(group => group.relationships.includes(value))?.label || 'Other';
}

function emptyDraft() {
  return { name: '', relationship: 'other', familyBranch: '' };
}

function groupPeople(people) {
  return GROUP_DEFINITIONS.reduce((groups, group) => {
    const members = sortTravelers(people.filter(person => group.relationships.includes(person.relationship)));
    if (members.length) groups.push({ ...group, members });
    return groups;
  }, []);
}

export default function PeoplePage({ setPage, setTravelerFilter }) {
  const { travelers, trips, addTraveler, updateTraveler, deleteTraveler, loadTravelers } = useData();
  const [newPerson, setNewPerson] = useState(emptyDraft);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(current => Object.fromEntries(
      travelers.map(person => [person.id, current[person.id] || {
        name: person.name,
        relationship: canonicalRelationship(person.relationship),
        familyBranch: person.family_branch || '',
      }])
    ));
  }, [travelers]);

  const memoryCounts = useMemo(() => {
    const counts = new Map();
    trips.forEach(trip => (trip.travelers || []).forEach(person => counts.set(person.id, (counts.get(person.id) || 0) + 1)));
    return counts;
  }, [trips]);

  const activePeople = sortTravelers(travelers.filter(person => person.is_active !== false));
  const inactivePeople = sortTravelers(travelers.filter(person => person.is_active === false));
  const activeGroups = groupPeople(activePeople);
  const inactiveGroups = groupPeople(inactivePeople);

  function updateDraft(id, field, value) {
    setDrafts(current => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function savePerson(person) {
    const draft = drafts[person.id];
    if (!draft?.name.trim()) return;
    setSavingId(person.id); setMessage(''); setError('');
    try {
      await updateTraveler(person.id, {
        name: draft.name.trim(), relationship: draft.relationship,
        familyBranch: draft.familyBranch.trim() || null, isActive: person.is_active !== false,
      });
      setEditingId(null); setMessage(`${draft.name.trim()} was updated.`);
    } catch (err) { setError(err.message || 'That person could not be updated.'); }
    finally { setSavingId(null); }
  }

  async function setActive(person, isActive) {
    setSavingId(person.id); setMessage(''); setError('');
    try {
      await updateTraveler(person.id, { isActive, name: person.name, relationship: person.relationship, familyBranch: person.family_branch || null });
      setMessage(`${person.name} is now ${isActive ? 'active' : 'inactive'}.`);
    } catch (err) { setError(err.message || 'That person could not be updated.'); }
    finally { setSavingId(null); }
  }

  async function movePerson(person, direction) {
    const siblings = sortTravelers(activePeople.filter(item => (
      GROUP_DEFINITIONS.find(group => group.relationships.includes(item.relationship))?.key === GROUP_DEFINITIONS.find(group => group.relationships.includes(person.relationship))?.key
      && (item.family_branch || '') === (person.family_branch || '')
    )));
    const currentIndex = siblings.findIndex(item => item.id === person.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const target = siblings[targetIndex];
    setSavingId(`order-${person.id}`); setMessage(''); setError('');
    try {
      await Promise.all([
        updateTraveler(person.id, { displayOrder: target.display_order ?? targetIndex }),
        updateTraveler(target.id, { displayOrder: person.display_order ?? currentIndex }),
      ]);
      setMessage(`${person.name} moved ${direction < 0 ? 'up' : 'down'}.`);
    } catch (err) { setError(err.message || 'That order could not be saved.'); }
    finally { setSavingId(null); }
  }

  async function removePerson(person) {
    const count = memoryCounts.get(person.id) || 0;
    const memoryNote = count > 0 ? ` This will remove ${count} ${count === 1 ? 'memory association' : 'memory associations'} but will not delete the memories themselves.` : '';
    if (!window.confirm(`Delete ${person.name}?${memoryNote} This cannot be undone.`)) return;
    setSavingId(person.id); setMessage(''); setError('');
    try { await deleteTraveler(person.id); setMessage(`${person.name} was deleted.`); }
    catch (err) { setError(err.message || 'That person could not be deleted.'); await loadTravelers({ includeInactive: true }); }
    finally { setSavingId(null); }
  }

  async function createPerson(event) {
    event.preventDefault();
    if (!newPerson.name.trim()) return;
    setSavingNew(true); setMessage(''); setError('');
    try {
      await addTraveler({ name: newPerson.name.trim(), relationship: newPerson.relationship, familyBranch: newPerson.familyBranch.trim() || null });
      setNewPerson(emptyDraft()); setShowCreateBranch(false); setMessage('Person added.');
    } catch (err) { setError(err.message || 'That person could not be added.'); }
    finally { setSavingNew(false); }
  }

  function viewMemories(person) {
    setTravelerFilter(String(person.id));
    setPage('trips');
  }

  function renderPerson(person, groupMembers) {
    const draft = drafts[person.id] || { name: person.name, relationship: canonicalRelationship(person.relationship), familyBranch: person.family_branch || '' };
    const isActive = person.is_active !== false;
    const count = memoryCounts.get(person.id) || 0;
    const position = groupMembers.findIndex(item => item.id === person.id);
    const isEditing = editingId === person.id;
    const isSaving = savingId === person.id;
    const isOrdering = savingId === `order-${person.id}`;

    return (
      <div key={person.id} className={`people-row ${isActive ? '' : 'is-inactive'}`}>
        <div className="people-row-main">
          <span className="people-avatar" aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
          <div className="people-row-copy">
            <strong>{person.name}</strong>
            <span>{relationshipLabel(person.relationship)} · {count} {count === 1 ? 'memory' : 'memories'}</span>
            {person.family_branch && <small>{person.family_branch}</small>}
          </div>
          {!isActive && <span className="people-status">Inactive</span>}
          <button type="button" className="people-more" onClick={() => setEditingId(isEditing ? null : person.id)} aria-label={`Edit ${person.name}`} title={`Edit ${person.name}`}><MoreHorizontal size={17} /></button>
        </div>

        {organizeOpen && isActive && (
          <div className="people-row-organize">
            <span className="people-order-label">Order in {person.family_branch || relationshipGroup(person.relationship)}</span>
            <div className="people-order-actions">
              <button type="button" onClick={() => movePerson(person, -1)} disabled={position === 0 || isOrdering} aria-label={`Move ${person.name} up`}><ChevronUp size={16} /></button>
              <button type="button" onClick={() => movePerson(person, 1)} disabled={position === groupMembers.length - 1 || isOrdering} aria-label={`Move ${person.name} down`}><ChevronDown size={16} /></button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="people-row-edit">
            <label>Name<input value={draft.name} onChange={event => updateDraft(person.id, 'name', event.target.value)} /></label>
            <label>Relationship<select value={draft.relationship} onChange={event => updateDraft(person.id, 'relationship', event.target.value)}>{RELATIONSHIPS.map(([id]) => <option key={id} value={id}>{relationshipLabel(id)}</option>)}</select></label>
            <label className="people-branch-field">Family branch <span>(optional)</span><input value={draft.familyBranch} onChange={event => updateDraft(person.id, 'familyBranch', event.target.value)} placeholder="Josh’s family" /></label>
            <div className="people-row-edit-actions">
              <button type="button" className="people-primary" onClick={() => savePerson(person)} disabled={isSaving || !draft.name.trim()}>{isSaving ? 'Saving…' : 'Save changes'}</button>
              <button type="button" className="people-secondary" onClick={() => setActive(person, !isActive)} disabled={isSaving}>{isActive ? 'Deactivate' : 'Reactivate'}</button>
              <button type="button" className="people-secondary" onClick={() => viewMemories(person)}>View memories</button>
              <button type="button" className="people-danger" onClick={() => removePerson(person)} disabled={isSaving}>Delete</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderGroups(groups) {
    return groups.map(group => {
      const branches = [...new Set(group.members.map(person => person.family_branch || ''))];
      return (
        <section className="people-group" key={group.relationship}>
          <div className="people-group-heading"><div><h3>{group.label}</h3><p>{group.members.length} {group.members.length === 1 ? 'person' : 'people'}</p></div></div>
          {branches.map(branch => {
            const members = group.members.filter(person => (person.family_branch || '') === branch);
            return (
              <div className="people-branch" key={branch || 'unassigned'}>
                {branch && <div className="people-branch-heading"><span>{branch}</span><small>{members.length}</small></div>}
                {members.map(person => renderPerson(person, members))}
              </div>
            );
          })}
        </section>
      );
    });
  }

  return (
    <div className="settings-people mx-auto max-w-6xl space-y-7">
      <div className="flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <p className="memory-eyebrow">Family manager</p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-forest-800 sm:text-4xl">The people in our stories</h1>
          <p className="mt-2 max-w-none text-gray-600">Keep names and relationships tidy in one place. Add the basics now; organize family branches later when it helps your memories read in the right order.</p>
        </div>
        <div className="people-page-actions"><button type="button" onClick={() => setOrganizeOpen(current => !current)} className={`people-organize-toggle ${organizeOpen ? 'is-active' : ''}`}>{organizeOpen ? 'Done organizing' : 'Organize branches and order'}</button><button type="button" onClick={() => loadTravelers({ includeInactive: true })} className="self-start rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-brand-forest-700 hover:text-brand-forest-800">Refresh people</button></div>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`} role="status">{error || message}</div>}

      <form onSubmit={createPerson} className="people-add-panel">
        <div className="people-add-heading"><div><h2>Add someone</h2><p>Start with a name and relationship. Family branches are optional.</p></div>{!showCreateBranch && <button type="button" className="people-link" onClick={() => setShowCreateBranch(true)}>Add a family branch</button>}</div>
        <div className="people-add-grid">
          <label>Name<input value={newPerson.name} onChange={event => setNewPerson(current => ({ ...current, name: event.target.value }))} placeholder="For example, Grandma Jo" /></label>
          <label>Relationship<select value={newPerson.relationship} onChange={event => setNewPerson(current => ({ ...current, relationship: event.target.value }))}>{RELATIONSHIPS.map(([id]) => <option key={id} value={id}>{relationshipLabel(id)}</option>)}</select></label>
          {showCreateBranch && <label>Family branch <span>(optional)</span><input value={newPerson.familyBranch} onChange={event => setNewPerson(current => ({ ...current, familyBranch: event.target.value }))} placeholder="Josh’s family" /></label>}
          <button type="submit" disabled={savingNew || !newPerson.name.trim()} className="people-primary">{savingNew ? 'Adding…' : 'Add person'}</button>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3"><div><h2 className="text-xl font-semibold text-brand-forest-800">Active people</h2><p className="text-sm text-gray-500">{activePeople.length} available for new memories.</p></div></div>
        {activePeople.length > 0 ? <div className="people-groups">{renderGroups(activeGroups)}</div> : <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">Add your first person above.</div>}
      </section>

      {inactivePeople.length > 0 && <section><div className="mb-3"><h2 className="text-xl font-semibold text-brand-forest-800">Inactive people</h2><p className="text-sm text-gray-500">Older memories stay connected. Reactivate someone whenever you need them for a new memory.</p></div><div className="people-groups">{renderGroups(inactiveGroups)}</div></section>}
    </div>
  );
}
