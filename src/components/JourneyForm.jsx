import { useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatDateOnly } from '../utils/format';

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
    coverPhotoId: journey?.cover_photo_id || '',
  });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const endDateAutoFilled = useRef(false);

  const visibleMemories = useMemo(() => {
    const queryTokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return [...trips]
      .filter(memory => {
        if (!queryTokens.length) return true;
        const searchText = getMemorySearchText(memory);
        return queryTokens.every(token => searchText.includes(token));
      })
      .sort((a, b) => {
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date) - new Date(b.start_date);
      });
  }, [trips, search]);

  const coverOptions = useMemo(() => trips
    .filter(memory => form.memoryIds.includes(memory.id))
    .flatMap(memory => (memory.photos || []).map(photo => ({
      ...photo,
      memoryLocation: memory.location_name,
    }))), [trips, form.memoryIds]);

  function toggleMemory(id) {
    setForm(current => ({
      ...current,
      memoryIds: current.memoryIds.includes(id)
        ? current.memoryIds.filter(memoryId => memoryId !== id)
        : [...current.memoryIds, id],
    }));
  }

  function handleDateChange(field, value) {
    if (field === 'endDate') {
      endDateAutoFilled.current = false;
      setForm(current => ({ ...current, endDate: value }));
      return;
    }

    setForm(current => {
      const mirrorEndDate = endDateAutoFilled.current || (!journey && !current.endDate);
      endDateAutoFilled.current = mirrorEndDate && Boolean(value);
      return {
        ...current,
        startDate: value,
        ...(mirrorEndDate ? { endDate: value } : {}),
      };
    });
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
    <div className="journey-form-modal fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1500]">
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
              <input type="date" value={form.startDate} onChange={event => handleDateChange('startDate', event.target.value)} />
            </label>
            <label>
              <span>End date</span>
              <input type="date" value={form.endDate} onChange={event => handleDateChange('endDate', event.target.value)} />
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
              placeholder="What made this journey special?"
            />
          </label>

          <label>
            <span>Journey cover <small>(optional)</small></span>
            <select
              value={form.coverPhotoId}
              onChange={event => setForm({ ...form, coverPhotoId: event.target.value })}
            >
              <option value="">Use the first memory cover</option>
              {coverOptions.map(photo => (
                <option key={photo.id} value={photo.id}>
                  {photo.memoryLocation} · {photo.caption || photo.filename || `Photo ${photo.id}`}
                </option>
              ))}
            </select>
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
                placeholder="Search memories, dates, places…"
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
    return formatDateOnly(memory.start_date, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  return memory.date_label || 'Date unknown';
}

function getMemorySearchText(memory) {
  const dateText = [memory.start_date, memory.end_date]
    .filter(Boolean)
    .map(date => [
      date,
      formatDateOnly(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      formatDateOnly(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      formatDateOnly(date, { month: 'numeric', day: 'numeric', year: 'numeric' }),
    ].join(' '));
  const photoText = (memory.photos || []).flatMap(photo => [photo.caption, photo.filename]);
  const travelerText = (memory.travelers || []).map(traveler => traveler.name);

  return [
    memory.location_name,
    memory.place_name,
    memory.formatted_address,
    memory.city,
    memory.state,
    memory.country,
    memory.trip_type,
    memory.notes,
    memory.date_label,
    ...dateText,
    ...photoText,
    ...travelerText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
