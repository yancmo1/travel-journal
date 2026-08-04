import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import TripForm from '../components/TripForm';
import MemoryPhotosModal from '../components/MemoryPhotosModal';
import api from '../utils/api';
import { formatDateOnly } from '../utils/format';
import { sortTravelers } from '../utils/travelers';

const TRIP_TYPES = ['All', 'Road Trip', 'Flight', 'Cruise', 'Day Trip', 'Other'];

export default function TripsPage({ initialTravelerFilter = 'all' }) {
  const { trips, travelers, loading, deleteTrip, loadTrips, loadJourneys } = useData();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [travelerFilter, setTravelerFilter] = useState(initialTravelerFilter);
  const [showForm, setShowForm] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [photoTrip, setPhotoTrip] = useState(null);
  const [backfillCount, setBackfillCount] = useState(0);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState('');

  useEffect(() => {
    setTravelerFilter(initialTravelerFilter || 'all');
  }, [initialTravelerFilter]);

  useEffect(() => {
    api.getLocationBackfillCandidates()
      .then(result => setBackfillCount(result.count))
      .catch(() => {});
  }, [trips]);

  // Filter and sort trips
  let filteredTrips = [...trips];

  if (filter !== 'All') {
    filteredTrips = filteredTrips.filter(t => t.trip_type === filter);
  }

  if (travelerFilter !== 'all') {
    filteredTrips = filteredTrips.filter(trip => (
      trip.travelers?.some(traveler => String(traveler.id) === travelerFilter)
    ));
  }

  if (search) {
    const q = search.trim().toLowerCase();
    filteredTrips = filteredTrips.filter(trip => {
      const searchable = [
        trip.location_name,
        trip.city,
        trip.state,
        trip.country,
        trip.notes,
        trip.date_label,
        trip.start_date,
        trip.end_date,
        trip.trip_type,
        trip.journey_title,
        ...(trip.travelers || []).map(traveler => traveler.name),
        ...(trip.photos || []).flatMap(photo => [photo.filename, photo.caption]),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  filteredTrips.sort((a, b) => {
    switch (sort) {
      case 'date-asc':
        return new Date(a.start_date) - new Date(b.start_date);
      case 'location':
        return (a.location_name || '').localeCompare(b.location_name || '');
      case 'type':
        return (a.trip_type || '').localeCompare(b.trip_type || '');
      default: // date-desc
        return new Date(b.start_date) - new Date(a.start_date);
    }
  });

  async function handleDelete(id) {
    await deleteTrip(id);
    setDeleteConfirm(null);
  }

  async function handleLocationBackfill() {
    setBackfilling(true);
    setBackfillMessage('');
    try {
      const result = await api.backfillPhotoLocations();
      await Promise.all([loadTrips(), loadJourneys()]);
      if (result.queued) {
        setBackfillMessage('Location lookup queued. The background runner will process a few memories at a time so larger photo libraries stay responsive. Refresh this page to see the results.');
      } else {
        setBackfillCount(result.skipped?.length || 0);
        setBackfillMessage(
          result.updated?.length
            ? `Found places for ${result.updated.length} ${result.updated.length === 1 ? 'memory' : 'memories'}.`
            : 'No additional places could be identified.'
        );
      }
    } catch (error) {
      setBackfillMessage(error.message || 'The location lookup could not finish.');
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ocean-dark flex items-center gap-2">
          <span>✦</span> Memories
          <span className="text-base font-normal text-gray-500">
            ({filteredTrips.length})
          </span>
        </h1>
        <button
          onClick={() => { setEditTrip(null); setShowForm(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-sunset-orange to-coral-pink text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <span>+</span> Add Memory
        </button>
      </div>

      {(backfillCount > 0 || backfillMessage) && (
        <section className="location-backfill-card">
          <div>
            <span aria-hidden="true">📍</span>
            <div>
              <h2>{backfillCount > 0 ? `${backfillCount} photos know where they were taken` : 'Photo locations updated'}</h2>
              <p>
                {backfillMessage || 'Their GPS can fill in memories that still say “Unknown Location.” Confirmed places will never be changed.'}
              </p>
            </div>
          </div>
          {backfillCount > 0 && (
            <button type="button" onClick={handleLocationBackfill} disabled={backfilling}>
              {backfilling ? 'Finding places…' : 'Fill missing places'}
            </button>
          )}
        </section>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search places, people, or notes..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            {TRIP_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === type
                    ? 'bg-ocean-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="location">By Location</option>
            <option value="type">By Type</option>
          </select>

          <select
            value={travelerFilter}
            onChange={e => setTravelerFilter(e.target.value)}
            aria-label="Filter memories by person"
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
          >
            <option value="all">Everyone</option>
            {sortTravelers(travelers).map(traveler => (
              <option key={traveler.id} value={traveler.id}>
                {traveler.name}{traveler.is_active === false ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Memories Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading memories...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <span className="text-5xl mb-4 block">🗺️</span>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No memories found</h3>
          <p className="text-gray-500 mb-6">
            {search || filter !== 'All' 
              ? 'Try adjusting your filters' 
              : 'Start adding your travel memories!'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-sunset-orange text-white rounded-lg hover:bg-coral-pink transition-colors"
          >
            Add Your First Memory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={() => { setEditTrip(trip); setShowForm(true); }}
              onPhotos={() => setPhotoTrip(trip)}
              onDelete={() => setDeleteConfirm(trip)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TripForm
          trip={editTrip}
          onClose={() => { setShowForm(false); setEditTrip(null); }}
        />
      )}

      {photoTrip && (
        <MemoryPhotosModal memory={photoTrip} onClose={() => setPhotoTrip(null)} />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1500]">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Memory?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deleteConfirm.location_name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, onEdit, onPhotos, onDelete }) {
  const typeColors = {
    'Road Trip': 'bg-green-500',
    'Flight': 'bg-blue-500',
    'Cruise': 'bg-purple-500',
    'Day Trip': 'bg-yellow-500',
    'Other': 'bg-gray-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group">
      {/* Color Bar */}
      <div className={`h-2 ${typeColors[trip.trip_type] || typeColors['Other']}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ocean-dark truncate text-lg">
              {trip.location_name}
            </h3>
            {trip.city && (
              <p className="text-sm text-gray-600">
                {[trip.city, trip.state, trip.country].filter(Boolean).join(', ')}
              </p>
            )}
            <p className="text-sm text-gray-500">
              {formatTripDate(trip)}
              {trip.end_date && trip.end_date !== trip.start_date && 
                ` - ${formatDate(trip.end_date)}`}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${typeColors[trip.trip_type] || typeColors['Other']}`}>
            {trip.trip_type || 'Other'}
          </span>
        </div>

        {trip.notes && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{trip.notes}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {trip.journey_title && (
            <span className="text-xs px-2 py-1 bg-amber-50 text-amber-800 rounded">
              Part of {trip.journey_title}
            </span>
          )}
          {trip.country && (
            <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
              {trip.country}
            </span>
          )}
          {trip.home_distance_miles && (
            <span className="text-xs px-2 py-1 bg-ocean-teal/10 text-ocean-teal rounded">
              {Math.round(trip.home_distance_miles).toLocaleString()} mi
            </span>
          )}
        </div>

        {/* Travelers */}
        {trip.travelers && trip.travelers.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {trip.travelers.slice(0, 4).map(t => (
              <span key={t.id} className="text-xs px-2 py-1 bg-sunset-orange/10 text-sunset-orange rounded">
                {t.name}
              </span>
            ))}
            {trip.travelers.length > 4 && (
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                +{trip.travelers.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={onPhotos}
            className="flex-1 py-2 text-sm text-ocean-teal hover:bg-ocean-teal/5 rounded-lg transition-colors"
          >
            Photos{trip.photos?.length ? ` (${trip.photos.length})` : ''}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-2 text-sm text-ocean-blue hover:bg-ocean-blue/5 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return formatDateOnly(dateStr, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTripDate(trip) {
  return trip.start_date ? formatDate(trip.start_date) : trip.date_label || 'Date unknown';
}
