import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import TripForm from '../components/TripForm';

const TRIP_TYPES = ['All', 'Road Trip', 'Flight', 'Cruise', 'Day Trip', 'Other'];

const TYPE_META = {
  'Road Trip': { icon: '🚗', bar: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'Flight':    { icon: '✈️', bar: 'bg-blue-400',    pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  'Cruise':    { icon: '🚢', bar: 'bg-purple-400',  pill: 'bg-purple-50 text-purple-700 border border-purple-200' },
  'Day Trip':  { icon: '☀️', bar: 'bg-amber-400',   pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'Other':     { icon: '📌', bar: 'bg-gray-300',    pill: 'bg-gray-50 text-gray-600 border border-gray-200' },
};

function getMeta(type) {
  return TYPE_META[type] || TYPE_META['Other'];
}

export default function TripsPage() {
  const { trips, loading, deleteTrip } = useData();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [showForm, setShowForm] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter and sort trips
  let filteredTrips = [...trips];

  if (filter !== 'All') {
    filteredTrips = filteredTrips.filter(t => t.trip_type === filter);
  }

  if (search) {
    const q = search.toLowerCase();
    filteredTrips = filteredTrips.filter(t =>
      t.location_name?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q) ||
      t.country?.toLowerCase().includes(q) ||
      t.state?.toLowerCase().includes(q)
    );
  }

  filteredTrips.sort((a, b) => {
    switch (sort) {
      case 'date-asc':
        return new Date(a.start_date) - new Date(b.start_date);
      case 'location':
        return (a.location_name || '').localeCompare(b.location_name || '');
      case 'type':
        return (a.trip_type || '').localeCompare(b.trip_type || '');
      default:
        return new Date(b.start_date) - new Date(a.start_date);
    }
  });

  async function handleDelete(id) {
    await deleteTrip(id);
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ocean-dark flex items-center gap-2">
            ✈️ All Trips
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredTrips.length} trip{filteredTrips.length !== 1 ? 's' : ''}
            {(search || filter !== 'All') ? ' matching your filters' : ' in your journal'}
          </p>
        </div>
        <button
          onClick={() => { setEditTrip(null); setShowForm(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-ocean-blue to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-2 text-sm"
        >
          <span className="text-base font-bold">+</span> Add Trip
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by location, country, notes…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-teal focus:border-transparent text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-ocean-teal text-sm"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="location">By Location</option>
            <option value="type">By Type</option>
          </select>
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === type
                  ? 'bg-ocean-blue text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type !== 'All' && <span className="mr-1">{getMeta(type).icon}</span>}
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-4xl block mb-3 animate-pulse">✈️</span>
          Loading your trips…
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-14 text-center">
          <span className="text-5xl mb-4 block">🗺️</span>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No trips found</h3>
          <p className="text-gray-400 text-sm mb-6">
            {search || filter !== 'All'
              ? 'Try adjusting your filters or search.'
              : 'Start capturing your travel memories!'}
          </p>
          {filter === 'All' && !search && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-ocean-blue to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-semibold"
            >
              Add Your First Trip
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={() => { setEditTrip(trip); setShowForm(true); }}
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

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1500]">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl text-center mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">Delete Trip?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">
              "<strong>{deleteConfirm.location_name}</strong>" will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 text-sm font-medium transition-colors"
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

function TripCard({ trip, onEdit, onDelete }) {
  const meta = getMeta(trip.trip_type);

  const nights = trip.start_date && trip.end_date
    ? Math.max(0, Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000))
    : null;

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Coloured top bar */}
      <div className={`h-1.5 ${meta.bar}`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ocean-dark truncate text-base leading-tight">
              {trip.location_name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(trip.start_date)}
              {trip.end_date && trip.end_date !== trip.start_date &&
                ` – ${formatDate(trip.end_date)}`}
              {nights > 0 && (
                <span className="text-gray-400"> · {nights}n</span>
              )}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${meta.pill}`}>
            {trip.trip_type || 'Other'}
          </span>
        </div>

        {trip.notes && (
          <p className="text-gray-500 text-xs mb-3 line-clamp-2 leading-relaxed">{trip.notes}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {trip.country && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
              🌐 {trip.country}
            </span>
          )}
          {trip.home_distance_miles && (
            <span className="text-xs px-2 py-0.5 bg-ocean-teal/10 text-ocean-teal rounded-full">
              {Math.round(trip.home_distance_miles).toLocaleString()} mi
            </span>
          )}
        </div>

        {/* Travelers */}
        {trip.travelers && trip.travelers.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trip.travelers.slice(0, 3).map(t => (
              <span key={t.id} className="text-xs px-2 py-0.5 bg-rose-warm/10 text-rose-warm rounded-full">
                {t.name}
              </span>
            ))}
            {trip.travelers.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                +{trip.travelers.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
          <button
            onClick={onEdit}
            className="flex-1 py-2 text-xs font-semibold text-ocean-blue hover:bg-ocean-blue/5 rounded-lg transition-colors"
          >
            ✏️ Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-2 text-xs font-semibold text-red-400 hover:bg-red-50 rounded-lg transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
