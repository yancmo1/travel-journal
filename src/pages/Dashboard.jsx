import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import MapView from '../components/Map';
import TripForm from '../components/TripForm';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const { trips, analytics, loading } = useData();
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const summary = analytics?.summary || {};
  const funStats = analytics?.funStats || {};
  const distance = analytics?.distance || {};

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="✈️"
          label="Total Memories"
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
            <div className="p-4 bg-gradient-to-r from-ocean-blue to-ocean-dark">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🗺️</span> Your Travel Map
              </h2>
            </div>
            <MapView trips={trips} onSelectTrip={setSelectedTrip} />
          </div>
          
          {/* Add Memory Button - Below Map */}
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-sunset-orange to-coral-pink hover:from-sunset-orange/90 hover:to-coral-pink/90 text-white rounded-xl transition-all shadow-lg hover:shadow-xl text-lg font-semibold flex items-center justify-center gap-3"
          >
            <span className="text-2xl">+</span> Add New Memory
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
              <span>🌟</span> Highlights
            </h3>
            <div className="space-y-3">
              {funStats.mostVisited && (
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-sunrise-yellow/20 to-transparent rounded-lg">
                  <span className="text-xl">🏆</span>
                  <div>
                    <div className="text-sm text-gray-600">Most Visited</div>
                    <div className="font-medium text-ocean-dark">
                      {funStats.mostVisited.location}
                    </div>
                    <div className="text-xs text-gray-500">
                      {funStats.mostVisited.count} times
                    </div>
                  </div>
                </div>
              )}

              {distance.furthestFromHome && (
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-ocean-teal/20 to-transparent rounded-lg">
                  <span className="text-xl">🌍</span>
                  <div>
                    <div className="text-sm text-gray-600">Furthest from Home</div>
                    <div className="font-medium text-ocean-dark">
                      {distance.furthestFromHome.location}
                    </div>
                    <div className="text-xs text-gray-500">
                      {distance.furthestFromHome.miles.toLocaleString()} miles
                    </div>
                  </div>
                </div>
              )}

              {analytics?.frequency?.travelStreak > 0 && (
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-coral-pink/20 to-transparent rounded-lg">
                  <span className="text-xl">🔥</span>
                  <div>
                    <div className="text-sm text-gray-600">Travel Streak</div>
                    <div className="font-medium text-ocean-dark">
                      {analytics.frequency.travelStreak} years
                    </div>
                    <div className="text-xs text-gray-500">consecutive</div>
                  </div>
                </div>
              )}

              {funStats.busiestMonth && (
                <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-sunset-orange/20 to-transparent rounded-lg">
                  <span className="text-xl">📅</span>
                  <div>
                    <div className="text-sm text-gray-600">Favorite Month</div>
                    <div className="font-medium text-ocean-dark">
                      {funStats.busiestMonth.month}
                    </div>
                    <div className="text-xs text-gray-500">
                      {funStats.busiestMonth.count} memories
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Memories */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
              <span>🕐</span> Recent Memories
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {trips.slice(0, 5).map(trip => (
                <div
                  key={trip.id}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  onClick={() => setSelectedTrip(trip)}
                >
                  <div className="font-medium text-ocean-dark truncate">
                    {trip.location_name}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>{formatDate(trip.start_date)}</span>
                    <span className="text-xs px-2 py-0.5 bg-ocean-teal/20 text-ocean-teal rounded">
                      {trip.trip_type}
                    </span>
                  </div>
                </div>
              ))}
              {trips.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No memories yet. Add your first adventure!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Form Modal */}
      {showForm && (
        <TripForm
          trip={null}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Memory Detail Modal */}
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}

function TripDetailModal({ trip, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1500]">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-ocean-dark">
                {trip.location_name}
              </h2>
              <p className="text-gray-500">
                {formatDate(trip.start_date)}
                {trip.end_date && trip.end_date !== trip.start_date && 
                  ` - ${formatDate(trip.end_date)}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTripTypeColor(trip.trip_type)}`}>
                {trip.trip_type}
              </span>
              {trip.country && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                  {trip.country}
                </span>
              )}
            </div>

            {trip.notes && (
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Notes</h4>
                <p className="text-gray-600">{trip.notes}</p>
              </div>
            )}

            {trip.home_distance_miles && (
              <div className="flex items-center gap-2 text-gray-600">
                <span>🛣️</span>
                <span>{Math.round(trip.home_distance_miles).toLocaleString()} miles from home</span>
              </div>
            )}

            {trip.travelers && trip.travelers.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Travelers</h4>
                <div className="flex flex-wrap gap-2">
                  {trip.travelers.map(t => (
                    <span key={t.id} className="px-3 py-1 bg-ocean-teal/10 text-ocean-teal rounded-full text-sm">
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
    'Flight': 'bg-blue-100 text-blue-700',
    'Cruise': 'bg-purple-100 text-purple-700',
    'Day Trip': 'bg-yellow-100 text-yellow-700',
    'Other': 'bg-gray-100 text-gray-700',
  };
  return colors[type] || colors['Other'];
}
