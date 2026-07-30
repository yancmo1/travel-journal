import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import MapView from '../components/Map';
import TripForm from '../components/TripForm';
import MemoryPhotosModal from '../components/MemoryPhotosModal';

export default function Dashboard({ setPage }) {
  const { trips, analytics, loading } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [memoryOffset, setMemoryOffset] = useState(0);
  const [startingMemoryId, setStartingMemoryId] = useState(null);
  const [photoTrip, setPhotoTrip] = useState(null);
  const touchStart = useRef(null);

  const summary = analytics?.summary || {};
  const memories = useMemo(
    () => [...trips].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
    [trips]
  );
  useEffect(() => {
    if (!memories.length || startingMemoryId !== null) return;

    const previousMemoryId = Number(localStorage.getItem('travel_last_memory_id'));
    const choices = memories.length > 1
      ? memories.filter(item => Number(item.id) !== previousMemoryId)
      : memories;
    const selected = choices[Math.floor(Math.random() * choices.length)];

    setStartingMemoryId(selected.id);
    setMemoryOffset(0);
    localStorage.setItem('travel_last_memory_id', String(selected.id));
  }, [memories, startingMemoryId]);

  const startingIndex = memories.findIndex(item => item.id === startingMemoryId);
  const activeIndex = memories.length
    ? ((startingIndex >= 0 ? startingIndex : 0) + memoryOffset + memories.length) % memories.length
    : 0;
  const memory = startingMemoryId !== null ? memories[activeIndex] : null;
  const memoryPhoto = getMemoryPhoto(memory);

  function showPrevious() {
    setMemoryOffset(value => value - 1);
  }

  function showNext() {
    setMemoryOffset(value => value + 1);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'ArrowLeft') setMemoryOffset(value => value - 1);
      if (event.key === 'ArrowRight') setMemoryOffset(value => value + 1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleTouchStart(event) {
    touchStart.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    if (Math.abs(distance) > 48) {
      distance > 0 ? showPrevious() : showNext();
    }
    touchStart.current = null;
  }

  return (
    <div className="memory-home">
      <section className="memory-intro">
        <p className="memory-eyebrow">A memory for right now</p>
        <h1>Look where life took us.</h1>
        <p>One place, one story, and plenty more waiting with a swipe.</p>
      </section>

      {(loading || (memories.length > 0 && startingMemoryId === null)) && !memory ? (
        <div className="memory-empty">Finding a memory…</div>
      ) : memory ? (
        <section
          key={memory.id}
          className={`memory-card memory-card-${getMemoryTheme(memory)} ${memoryPhoto ? 'has-photo' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-live="polite"
        >
          {memoryPhoto ? (
            <img
              className="memory-card-photo"
              src={`/photos/${memoryPhoto.file_path || memoryPhoto.thumbnail_path}`}
              alt={`A memory from ${memory.location_name}`}
            />
          ) : (
            <div className="memory-card-horizon" aria-hidden="true">
              <span className="memory-sun" />
              <span className="memory-land memory-land-one" />
              <span className="memory-land memory-land-two" />
            </div>
          )}
          <div className="memory-card-content">
            <div className="memory-card-meta">
              <span>{getYear(memory)}</span>
              <span aria-hidden="true">•</span>
              <span>{memory.trip_type || 'A trip together'}</span>
            </div>
            <h2>{memory.location_name}</h2>
            <p className="memory-date">{formatDateRange(memory)}</p>
            <p className="memory-note">
              {memory.notes || 'Another place that became part of our story.'}
            </p>
            <button type="button" className="memory-open" onClick={() => setSelectedTrip(memory)}>
              Open this memory
            </button>
          </div>
          <div className="memory-card-count">
            {activeIndex + 1} of {memories.length}
          </div>
        </section>
      ) : (
        <section className="memory-empty">
          <span aria-hidden="true">✦</span>
          <h2>Your first memory starts with a place.</h2>
          <p>Add one trip now, then bring in the rest of your list when it’s ready.</p>
          <button type="button" onClick={() => { setEditingTrip(null); setShowForm(true); }}>Add our first trip</button>
        </section>
      )}

      {memory && (
        <div className="memory-controls">
          <button type="button" onClick={showPrevious} aria-label="Show previous memory">
            <span aria-hidden="true">←</span> Previous
          </button>
          <p>Swipe or use the arrows</p>
          <button type="button" onClick={showNext} aria-label="Show next memory">
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      <section className="memory-after">
        <div className="memory-story-summary">
          <p className="memory-eyebrow">Our story so far</p>
          <div className="memory-summary-numbers">
            <div><strong>{summary.totalTrips || trips.length}</strong><span>memories</span></div>
            <div><strong>{summary.uniqueLocations || new Set(trips.map(t => t.location_name)).size}</strong><span>places</span></div>
            <div><strong>{getYearsTogether(trips)}</strong><span>years of memories</span></div>
          </div>
          <button type="button" className="memory-text-link" onClick={() => setPage('journeys')}>
            Open our journeys <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="memory-map-preview">
          <div className="memory-section-heading">
            <div>
              <p className="memory-eyebrow">Everywhere we’ve been</p>
              <h2>Our map</h2>
            </div>
            <button type="button" onClick={() => { setEditingTrip(null); setShowForm(true); }}>+ Add a trip</button>
          </div>
          <MapView trips={trips} onSelectTrip={setSelectedTrip} compact />
        </div>
      </section>

      {showForm && (
        <TripForm
          trip={editingTrip}
          onClose={() => { setShowForm(false); setEditingTrip(null); }}
        />
      )}
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
          onPhotos={() => { setPhotoTrip(selectedTrip); setSelectedTrip(null); }}
          onEdit={() => {
            setEditingTrip(selectedTrip);
            setSelectedTrip(null);
            setShowForm(true);
          }}
        />
      )}
      {photoTrip && <MemoryPhotosModal memory={photoTrip} onClose={() => setPhotoTrip(null)} />}
    </div>
  );
}

function TripDetailModal({ trip, onClose, onPhotos, onEdit }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1500]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-7">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="memory-eyebrow">{getYear(trip)} memory</p>
              <h2 className="text-3xl font-semibold text-ocean-dark mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                {trip.location_name}
              </h2>
              <p className="text-gray-500 mt-1">{formatDateRange(trip)}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close memory">
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTripTypeColor(trip.trip_type)}`}>
                {trip.trip_type || 'Trip'}
              </span>
              {trip.country && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">{trip.country}</span>
              )}
            </div>
            <p className="text-gray-700 text-lg leading-relaxed">
              {trip.notes || 'Another place that became part of our story.'}
            </p>
            {trip.travelers?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {trip.travelers.map(traveler => (
                  <span key={traveler.id} className="px-3 py-1 bg-ocean-teal/10 text-ocean-teal rounded-full text-sm">
                    {traveler.name}
                  </span>
                ))}
              </div>
            )}
            {trip.photos?.length > 0 && (
              <div className="journey-photo-strip">
                {trip.photos.slice(0, 4).map(photo => (
                  <img key={photo.id} src={`/photos/${photo.thumbnail_path}`} alt={photo.filename} />
                ))}
              </div>
            )}
            <button type="button" className="memory-open" onClick={onPhotos}>
              {trip.photos?.length ? `View or add photos (${trip.photos.length})` : '+ Add photos'}
            </button>
          </div>
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-semibold text-gray-500 hover:text-ocean-teal"
            >
              Edit memory →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateRange(trip) {
  if (!trip.start_date) return trip.date_label || 'Date still being remembered';
  const start = formatDate(trip.start_date);
  const end = trip.end_date && trip.end_date !== trip.start_date ? formatDate(trip.end_date) : '';
  return end ? `${start} — ${end}` : start;
}

function getYear(trip) {
  if (trip?.start_date) return new Date(trip.start_date).getFullYear();
  return trip?.date_label || 'Date to be remembered';
}

function getYearsTogether(trips) {
  const years = trips
    .map(trip => trip.start_date ? new Date(trip.start_date).getFullYear() : Number(trip.date_label))
    .filter(Number.isFinite);
  if (!years.length) return 0;
  return new Date().getFullYear() - Math.min(...years) + 1;
}

function getMemoryTheme(trip) {
  const words = `${trip.location_name} ${trip.state || ''} ${trip.notes || ''}`;
  if (trip.country && trip.country !== 'United States') return 'tropical';
  if (trip.trip_type === 'Cruise' || /florida|beach|destin/i.test(words)) return 'coast';
  if (/vegas|nevada|arizona|desert/i.test(words)) return 'desert';
  return 'open-road';
}

function getMemoryPhoto(trip) {
  return trip?.photos?.find(photo => photo?.file_path || photo?.thumbnail_path) || null;
}

function getTripTypeColor(type) {
  const colors = {
    'Road Trip': 'bg-green-100 text-green-700',
    Flight: 'bg-blue-100 text-blue-700',
    Cruise: 'bg-purple-100 text-purple-700',
    'Day Trip': 'bg-yellow-100 text-yellow-700',
    Other: 'bg-gray-100 text-gray-700',
  };
  return colors[type] || colors.Other;
}
