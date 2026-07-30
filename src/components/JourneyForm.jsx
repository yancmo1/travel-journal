import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';

const JOURNEY_TYPES = ['Road Trip', 'Cruise', 'Flight', 'Weekend', 'Vacation', 'Other'];

export default function JourneyForm({ journey, onClose }) {
  const { trips, addJourney, updateJourney } = useData();
  const [form, setForm] = useState({
    title: journey?.title || '',
    startDate: journey?.start_date?.split('T')[0] || '',
    endDate: journey?.end_date?.split('T')[0] || '',
    dateLabel: journey?.date_label || '',
    journeyType: journey?.journey_type || 'Other',
    summary: journey?.summary || '',
    memoryIds: journey?.memories?.map(memory => memory.id) || [],
  });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visibleMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...trips]
      .filter(memory => !query || [
        memory.location_name, memory.city, memory.state, memory.country, memory.notes
      ].some(value => value?.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date) - new Date(b.start_date);
      });
  }, [trips, search]);

  function toggleMemory(id) {
    setForm(current => ({
      ...current,
      memoryIds: current.memoryIds.includes(id)
        ? current.memoryIds.filter(memoryId => memoryId !== id)
        : [...current.memoryIds, id],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Give this journey a name');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (journey) {
        await updateJourney(journey.id, form);
      } else {
        await addJourney(form);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save this journey');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1500]">
      <div className="journey-form-shell">
        <div className="journey-form-heading">
          <div>
            <p className="memory-eyebrow">{journey ? 'Update the story' : 'Bring memories together'}</p>
            <h2>{journey ? 'Edit journey' : 'Create a journey'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close journey form">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="journey-form">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

          <label>
            <span>Journey name *</span>
            <input
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
              placeholder="Mexican Riviera Cruise"
            />
          </label>

          <div className="journey-form-row">
            <label>
              <span>Start date</span>
              <input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} />
            </label>
            <label>
              <span>End date</span>
              <input type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} />
            </label>
            <label>
              <span>Type</span>
              <select value={form.journeyType} onChange={event => setForm({ ...form, journeyType: event.target.value })}>
                {JOURNEY_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </label>
          </div>

          <label>
            <span>Date note <small>(use this when dates are uncertain)</small></span>
            <input
              value={form.dateLabel}
              onChange={event => setForm({ ...form, dateLabel: event.target.value })}
              placeholder="Summer 2005 or around 1999"
            />
          </label>

          <label>
            <span>The story</span>
            <textarea
              rows="3"
              value={form.summary}
              onChange={event => setForm({ ...form, summary: event.target.value })}
              placeholder="What made this trip special?"
            />
          </label>

          <section className="journey-memory-picker">
            <div className="journey-picker-heading">
              <div>
                <h3>Memories in this journey</h3>
                <p>{form.memoryIds.length} selected · check them in story order</p>
              </div>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Find a place"
                aria-label="Find a memory"
              />
            </div>

            <div className="journey-memory-options">
              {visibleMemories.map(memory => (
                <label key={memory.id} className={form.memoryIds.includes(memory.id) ? 'is-selected' : ''}>
                  <input
                    type="checkbox"
                    checked={form.memoryIds.includes(memory.id)}
                    onChange={() => toggleMemory(memory.id)}
                  />
                  <span>
                    <strong>{memory.location_name}</strong>
                    <small>{formatMemoryDate(memory)}{memory.journey_id && memory.journey_id !== journey?.id ? ' · already in another journey' : ''}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <div className="journey-form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save journey'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatMemoryDate(memory) {
  if (memory.start_date) {
    return new Date(memory.start_date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  return memory.date_label || 'Date unknown';
}
