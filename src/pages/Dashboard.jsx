import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import MapView from '../components/Map';
import TripForm from '../components/TripForm';
import StatCard from '../components/StatCard';
import { ArrowUpRight, Camera, Image, MapPin, Navigation } from 'lucide-react';
import postmark from '../../assets/postmark.webp';
import addMemoryButton from '../../assets/add-memory-button.webp';

export default function Dashboard() {
  const { trips, analytics, loading } = useData();
  const [showForm, setShowForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const summary = analytics?.summary || {};
  return (
    <div className="dashboard-sample">
      <section className="dashboard-intro" aria-labelledby="dashboard-title">
        <div>
          <p className="dashboard-kicker">A private atlas of shared days</p>
          <h1 id="dashboard-title">Where we’ve been,<br /><em>together.</em></h1>
        </div>
        <div className="dashboard-intro-actions">
          <img className="dashboard-postmark" src={postmark} alt="" aria-hidden="true" />
          <button
            onClick={() => setShowForm(true)}
            className="dashboard-add-memory dashboard-add-memory-top"
          >
            <img className="dashboard-add-memory-art" src={addMemoryButton} alt="" aria-hidden="true" />
            <span className="dashboard-add-memory-label"><Camera aria-hidden="true" /> Add a memory</span>
          </button>
        </div>
      </section>

      <div className="dashboard-stat-strip" aria-label="Travel summary">
        <StatCard
          icon={<Image aria-hidden="true" />}
          label="memories"
          value={summary.totalTrips || 0}
          color="ocean"
        />
        <StatCard
          icon={<MapPin aria-hidden="true" />}
          label="places"
          value={summary.uniqueLocations || 0}
          color="teal"
        />
        <StatCard
          icon={<Navigation aria-hidden="true" />}
          label="miles"
          value={summary.totalMiles?.toLocaleString() || 0}
          color="sunset"
        />
      </div>

      <section className="dashboard-atlas-panel" aria-labelledby="atlas-title">
          <div className="dashboard-section-head">
            <div>
              <p className="dashboard-kicker">The atlas</p>
              <h2 id="atlas-title">Your travel map</h2>
            </div>
            <span className="dashboard-coordinate" aria-hidden="true">MAP / 01</span>
          </div>
          <div className="dashboard-map-frame">
            <MapView trips={trips} onSelectTrip={setSelectedTrip} showRoutes />
          </div>

          <section className="dashboard-recent" aria-labelledby="recent-title">
            <div className="dashboard-section-head dashboard-section-head-compact">
              <div>
                <p className="dashboard-kicker">The latest pages</p>
                <h2 id="recent-title">Recent memories</h2>
              </div>
              {trips.length > 0 && (
                <span className="dashboard-inline-link">View memories <ArrowUpRight aria-hidden="true" /></span>
              )}
            </div>
            <div className="dashboard-recent-grid">
              {trips.slice(0, 4).map(trip => {
                const photo = trip.photos?.find(item => item.is_cover && item.thumbnail_path)
                  || trip.photos?.find(item => item.thumbnail_path);
                return (
                  <button
                    type="button"
                    key={trip.id}
                    className="dashboard-recent-item"
                    onClick={() => setSelectedTrip(trip)}
                  >
                    {photo ? (
                      <img src={`/photos/${photo.thumbnail_path}`} alt="" />
                    ) : (
                      <span className="dashboard-recent-placeholder" aria-hidden="true"><MapPin /></span>
                    )}
                    <span className="dashboard-recent-copy">
                      <strong>{trip.location_name}</strong>
                      <span>{formatDate(trip.start_date)}</span>
                      <small>{trip.trip_type}</small>
                    </span>
                    <ArrowUpRight className="dashboard-recent-arrow" aria-hidden="true" />
                  </button>
                );
              })}
              {trips.length === 0 && (
                <div className="dashboard-empty-state">
                  <Image aria-hidden="true" />
                  <p>No memories yet. Add your first adventure.</p>
                </div>
              )}
            </div>
          </section>
      </section>

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
    <div className="memory-detail-modal fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1500]">
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
