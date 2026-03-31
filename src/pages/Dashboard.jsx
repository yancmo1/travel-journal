import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import MapView from '../components/Map';
import TripForm from '../components/TripForm';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const { user } = useAuth();
  const { trips, analytics, loading } = useData();
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const summary = analytics?.summary || {};
  const funStats = analytics?.funStats || {};
  const distance = analytics?.distance || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-ocean-blue to-indigo-700 rounded-2xl p-5 shadow-lg text-white flex items-center justify-between gap-4">
        <div>
          <p className="text-white/70 text-sm mb-0.5">Welcome back,</p>
          <h2 className="text-xl font-bold">{user?.display_name || user?.username} 👋</h2>
          <p className="text-white/60 text-sm mt-1">
            {summary.totalTrips
              ? `You've explored ${summary.totalTrips} destination${summary.totalTrips !== 1 ? 's' : ''} across ${summary.countries || 0} ${summary.countries === 1 ? 'country' : 'countries'} together.`
              : 'Start adding your travel memories!'}
          </p>
        </div>
        <div className="text-5xl hidden sm:block opacity-80 select-none">💕</div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="✈️"
          label="Total Trips"
          value={summary.totalTrips || 0}
          color="ocean"
        />
        <StatCard
          icon="📍"
          label="Locations"
          value={summary.uniqueLocations || 0}
          color="teal"
        />
        <StatCard
          icon="🛣️"
          label="Miles Traveled"
          value={summary.totalMiles?.toLocaleString() || 0}
          color="sunset"
        />
        <StatCard
          icon="📅"
          label="Days Traveling"
          value={summary.totalDaysTraveled || 0}
          color="coral"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-ocean-blue to-indigo-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>🗺️</span> Travel Map
              </h2>
              <span className="text-white/60 text-xs">{trips.length} pin{trips.length !== 1 ? 's' : ''}</span>
            </div>
            <MapView trips={trips} onSelectTrip={setSelectedTrip} />
          </div>

          {/* Add Trip Button */}
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-ocean-teal to-teal-500 hover:from-ocean-teal/90 hover:to-teal-500/90 active:scale-[0.99] text-white rounded-xl transition-all shadow-lg hover:shadow-xl text-base font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-xl font-bold">+</span> Log New Trip
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Highlights */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span>⭐</span> Highlights
            </h3>
            <div className="space-y-2">
              {funStats.mostVisited && (
                <HighlightRow
                  icon="🏆"
                  label="Most Visited"
                  value={funStats.mostVisited.location}
                  sub={`${funStats.mostVisited.count}× visited`}
                  bgClass="bg-sunrise-yellow/15"
                />
              )}
              {distance.furthestFromHome && (
                <HighlightRow
                  icon="🌍"
                  label="Furthest Away"
                  value={distance.furthestFromHome.location}
                  sub={`${distance.furthestFromHome.miles.toLocaleString()} miles`}
                  bgClass="bg-ocean-teal/10"
                />
              )}
              {analytics?.frequency?.travelStreak > 0 && (
                <HighlightRow
                  icon="🔥"
                  label="Travel Streak"
                  value={`${analytics.frequency.travelStreak} years`}
                  sub="consecutive travel"
                  bgClass="bg-rose-warm/10"
                />
              )}
              {funStats.busiestMonth && (
                <HighlightRow
                  icon="📅"
                  label="Favourite Month"
                  value={funStats.busiestMonth.month}
                  sub={`${funStats.busiestMonth.count} trips`}
                  bgClass="bg-sunset-orange/10"
                />
              )}
              {!funStats.mostVisited && !distance.furthestFromHome && (
                <p className="text-gray-400 text-sm text-center py-3">
                  Add trips to see highlights here!
                </p>
              )}
            </div>
          </div>

          {/* Recent Trips */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span>🕐</span> Recent Trips
            </h3>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {trips.slice(0, 5).map(trip => (
                <button
                  key={trip.id}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors group"
                  onClick={() => setSelectedTrip(trip)}
                >
                  <div className="font-medium text-ocean-dark truncate text-sm group-hover:text-ocean-blue">
                    {trip.location_name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{formatDate(trip.start_date)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${getTripTypePill(trip.trip_type)}`}>
                      {trip.trip_type}
                    </span>
                  </div>
                </button>
              ))}
              {trips.length === 0 && (
                <div className="text-center py-6">
                  <span className="text-3xl block mb-2">🗺️</span>
                  <p className="text-gray-400 text-sm">No trips yet — start exploring!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trip Form Modal */}
      {showForm && (
        <TripForm
          trip={null}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Trip Detail Modal */}
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}

function HighlightRow({ icon, label, value, sub, bgClass }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${bgClass}`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-ocean-dark text-sm truncate">{value}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
    </div>
  );
}

function TripDetailModal({ trip, onClose }) {
  const nights = trip.start_date && trip.end_date
    ? Math.max(0, Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000))
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1500]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header strip */}
        <div className={`h-2 rounded-t-2xl ${getTripTypeBar(trip.trip_type)}`} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-ocean-dark">{trip.location_name}</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {formatDate(trip.start_date)}
                {trip.end_date && trip.end_date !== trip.start_date &&
                  ` – ${formatDate(trip.end_date)}`}
                {nights > 0 && (
                  <span className="ml-2 text-xs text-gray-400">({nights} night{nights !== 1 ? 's' : ''})</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTripTypeColor(trip.trip_type)}`}>
                {trip.trip_type}
              </span>
              {trip.country && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                  🌐 {trip.country}
                </span>
              )}
              {trip.state && trip.country === 'United States' && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                  {trip.state}
                </span>
              )}
            </div>

            {trip.notes && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{trip.notes}</p>
              </div>
            )}

            {trip.home_distance_miles && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-ocean-teal/5 p-3 rounded-xl">
                <span>🛣️</span>
                <span>{Math.round(trip.home_distance_miles).toLocaleString()} miles from home</span>
              </div>
            )}

            {trip.travelers && trip.travelers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Travelers</h4>
                <div className="flex flex-wrap gap-2">
                  {trip.travelers.map(t => (
                    <span key={t.id} className="px-3 py-1.5 bg-rose-warm/10 text-rose-warm rounded-full text-sm font-medium">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
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

function getTripTypeColor(type) {
  const colors = {
    'Road Trip': 'bg-green-100 text-green-700',
    'Flight':    'bg-blue-100 text-blue-700',
    'Cruise':    'bg-purple-100 text-purple-700',
    'Day Trip':  'bg-amber-100 text-amber-700',
    'Other':     'bg-gray-100 text-gray-700',
  };
  return colors[type] || colors['Other'];
}

function getTripTypeBar(type) {
  const bars = {
    'Road Trip': 'bg-green-400',
    'Flight':    'bg-blue-400',
    'Cruise':    'bg-purple-400',
    'Day Trip':  'bg-amber-400',
    'Other':     'bg-gray-300',
  };
  return bars[type] || bars['Other'];
}

function getTripTypePill(type) {
  const pills = {
    'Road Trip': 'bg-green-100 text-green-700',
    'Flight':    'bg-blue-100 text-blue-700',
    'Cruise':    'bg-purple-100 text-purple-700',
    'Day Trip':  'bg-amber-100 text-amber-700',
    'Other':     'bg-gray-100 text-gray-600',
  };
  return pills[type] || pills['Other'];
}
