import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import TripForm from '../components/TripForm';
import MemoryPhotosModal from '../components/MemoryPhotosModal';
import { formatDateOnly } from '../utils/format';

const FILTERS = [
  ['all', 'All memories'],
  ['duplicates', 'Possible duplicates'],
  ['missing-date', 'Missing date'],
  ['missing-place', 'Missing place'],
  ['no-photos', 'No photos'],
  ['no-journey', 'Not in a journey'],
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dateLabel(trip) {
  if (trip.start_date) {
    return formatDateOnly(trip.start_date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return trip.date_label || 'Date missing';
}

function duplicateKey(trip) {
  const place = normalize(trip.location_name);
  const date = trip.start_date?.slice(0, 10) || normalize(trip.date_label);
  return place && date ? `${place}|${date}` : null;
}

function getFlags(trip, duplicateIds) {
  const flags = [];
  if (duplicateIds.has(trip.id)) flags.push(['duplicate', 'Possible duplicate']);
  if (!trip.start_date && !trip.date_label) flags.push(['date', 'Missing date']);
  if (!trip.location_name || normalize(trip.location_name).includes('unknown location')) {
    flags.push(['place', 'Missing place']);
  }
  if (!trip.photos?.length) flags.push(['photos', 'No photos']);
  if (!trip.journey_title) flags.push(['journey', 'No journey']);
  return flags;
}

export default function CleanupPage() {
  const { trips, loading, deleteTrips } = useData();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date-asc');
  const [selected, setSelected] = useState(() => new Set());
  const [editTrip, setEditTrip] = useState(null);
  const [photoTrip, setPhotoTrip] = useState(null);
  const [deleteCandidates, setDeleteCandidates] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const duplicateIds = useMemo(() => {
    const groups = new Map();
    trips.forEach(trip => {
      const key = duplicateKey(trip);
      if (!key) return;
      groups.set(key, [...(groups.get(key) || []), trip.id]);
    });

    return new Set(
      [...groups.values()]
        .filter(ids => ids.length > 1)
        .flat()
    );
  }, [trips]);

  const counts = useMemo(() => ({
    duplicates: trips.filter(trip => duplicateIds.has(trip.id)).length,
    missingDate: trips.filter(trip => !trip.start_date && !trip.date_label).length,
    missingPlace: trips.filter(
      trip => !trip.location_name || normalize(trip.location_name).includes('unknown location')
    ).length,
    noPhotos: trips.filter(trip => !trip.photos?.length).length,
    noJourney: trips.filter(trip => !trip.journey_title).length,
  }), [trips, duplicateIds]);

  const visibleTrips = useMemo(() => {
    const query = normalize(search);
    const result = trips.filter(trip => {
      if (query) {
        const searchable = normalize([
          trip.location_name,
          trip.city,
          trip.state,
          trip.country,
          trip.notes,
          trip.journey_title,
          ...(trip.travelers || []).map(traveler => traveler.name),
        ].join(' '));
        if (!searchable.includes(query)) return false;
      }

      switch (filter) {
        case 'duplicates':
          return duplicateIds.has(trip.id);
        case 'missing-date':
          return !trip.start_date && !trip.date_label;
        case 'missing-place':
          return !trip.location_name || normalize(trip.location_name).includes('unknown location');
        case 'no-photos':
          return !trip.photos?.length;
        case 'no-journey':
          return !trip.journey_title;
        default:
          return true;
      }
    });

    result.sort((a, b) => {
      if (sort === 'location') {
        return (a.location_name || '').localeCompare(b.location_name || '');
      }
      if (sort === 'newest-added') return b.id - a.id;
      if (sort === 'most-issues') {
        return getFlags(b, duplicateIds).length - getFlags(a, duplicateIds).length;
      }

      const aDate = a.start_date ? Date.parse(a.start_date) : Number.MAX_SAFE_INTEGER;
      const bDate = b.start_date ? Date.parse(b.start_date) : Number.MAX_SAFE_INTEGER;
      return aDate - bDate || a.id - b.id;
    });

    return result;
  }, [trips, search, filter, sort, duplicateIds]);

  const allVisibleSelected = visibleTrips.length > 0
    && visibleTrips.every(trip => selected.has(trip.id));

  function toggleSelected(id) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(current => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleTrips.forEach(trip => next.delete(trip.id));
      } else {
        visibleTrips.forEach(trip => next.add(trip.id));
      }
      return next;
    });
  }

  async function confirmDelete() {
    setDeleting(true);
    setMessage('');
    try {
      const result = await deleteTrips(deleteCandidates.map(trip => trip.id));
      setSelected(current => {
        const next = new Set(current);
        result.deletedIds.forEach(id => next.delete(id));
        return next;
      });
      setDeleteCandidates([]);
      setMessage(`Deleted ${result.count} ${result.count === 1 ? 'memory' : 'memories'} and their saved photo copies.`);
    } catch (error) {
      setMessage(error.message || 'The selected memories could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  function requestSelectedDelete() {
    setDeleteCandidates(trips.filter(trip => selected.has(trip.id)));
  }

  return (
    <div className="settings-cleanup space-y-6">
      <header className="flex flex-col gap-2">
        <p className="memory-eyebrow">Tidy the collection</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-ocean-dark">Memory cleanup</h1>
            <p className="text-gray-600 mt-1">
              Scan everything in one place. Nothing is deleted without a final confirmation.
            </p>
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={requestSelectedDelete}
              className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600"
            >
              Delete selected ({selected.size})
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <IssueCard label="Possible duplicates" count={counts.duplicates} onClick={() => setFilter('duplicates')} />
        <IssueCard label="Missing dates" count={counts.missingDate} onClick={() => setFilter('missing-date')} />
        <IssueCard label="Missing places" count={counts.missingPlace} onClick={() => setFilter('missing-place')} />
        <IssueCard label="No photos" count={counts.noPhotos} onClick={() => setFilter('no-photos')} />
        <IssueCard label="Not in a journey" count={counts.noJourney} onClick={() => setFilter('no-journey')} />
      </section>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.startsWith('Deleted')
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <section className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search locations, notes, journeys, or people…"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
            />
            <select
              value={filter}
              onChange={event => setFilter(event.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg"
            >
              {FILTERS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={event => setSort(event.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg"
            >
              <option value="date-asc">Oldest first</option>
              <option value="location">By location</option>
              <option value="newest-added">Recently added</option>
              <option value="most-issues">Most issues</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{visibleTrips.length} of {trips.length} memories</span>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-ocean-blue">
                Clear selection
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-gray-500">Loading memories…</p>
        ) : visibleTrips.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">✓</p>
            <h2 className="font-semibold text-ocean-dark">Nothing to clean up here</h2>
            <p className="text-sm text-gray-500 mt-1">Try another filter or search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible memories"
                    />
                  </th>
                  <th className="px-4 py-3">Memory</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Journey</th>
                  <th className="px-4 py-3">Photos</th>
                  <th className="px-4 py-3">Needs attention</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleTrips.map(trip => {
                  const flags = getFlags(trip, duplicateIds);
                  return (
                    <tr key={trip.id} className={selected.has(trip.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(trip.id)}
                          onChange={() => toggleSelected(trip.id)}
                          aria-label={`Select ${trip.location_name}`}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <strong className="block text-ocean-dark">{trip.location_name || 'Unknown location'}</strong>
                        <span className="block max-w-xs truncate text-xs text-gray-500">
                          {[trip.city, trip.state, trip.country].filter(Boolean).join(', ') || trip.notes || 'No details yet'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">{dateLabel(trip)}</td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        {trip.journey_title || <span className="text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <button type="button" onClick={() => setPhotoTrip(trip)} className="text-ocean-teal hover:underline">
                          {trip.photos?.length || 0} {trip.photos?.length === 1 ? 'photo' : 'photos'}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {flags.length === 0 ? (
                            <span className="text-xs text-green-600">Looks good</span>
                          ) : flags.map(([key, label]) => (
                            <span key={key} className="px-2 py-1 rounded bg-amber-50 text-amber-800 text-xs">
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditTrip(trip)} className="px-3 py-1.5 text-sm text-ocean-blue hover:bg-blue-50 rounded">
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteCandidates([trip])} className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editTrip && <TripForm trip={editTrip} onClose={() => setEditTrip(null)} />}
      {photoTrip && <MemoryPhotosModal memory={photoTrip} onClose={() => setPhotoTrip(null)} />}

      {deleteCandidates.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1600]">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <p className="memory-eyebrow text-red-500">Final confirmation</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-1">
              Delete {deleteCandidates.length} {deleteCandidates.length === 1 ? 'memory' : 'memories'}?
            </h2>
            <p className="text-gray-600 mt-2">
              Their database entries and saved photo copies will be removed. Your nightly backups remain available.
            </p>
            <ul className="mt-4 max-h-36 overflow-auto text-sm text-gray-700 list-disc pl-5">
              {deleteCandidates.slice(0, 8).map(trip => (
                <li key={trip.id}>{trip.location_name} — {dateLabel(trip)}</li>
              ))}
              {deleteCandidates.length > 8 && <li>and {deleteCandidates.length - 8} more…</li>}
            </ul>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteCandidates([])}
                disabled={deleting}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Keep them
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-xl shadow p-4 text-left hover:shadow-md hover:-translate-y-0.5 transition"
    >
      <strong className="block text-2xl text-ocean-dark">{count}</strong>
      <span className="text-sm text-gray-600">{label}</span>
    </button>
  );
}
