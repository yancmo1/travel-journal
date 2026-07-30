import { useState } from 'react';
import { useData } from '../context/DataContext';
import JourneyForm from '../components/JourneyForm';
import MapView from '../components/Map';
import MemoryPhotosModal from '../components/MemoryPhotosModal';
import { formatDateOnly } from '../utils/format';

export default function JourneysPage() {
  const { journeys, deleteJourney } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [photoMemory, setPhotoMemory] = useState(null);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function removeJourney(journey) {
    if (!window.confirm(`Delete "${journey.title}"? Its memories will stay safely in All places.`)) return;
    await deleteJourney(journey.id);
    setSelected(null);
  }

  return (
    <div className="journeys-page">
      <section className="journeys-hero">
        <div>
          <p className="memory-eyebrow">The bigger stories</p>
          <h1>Our journeys</h1>
          <p>Bring every stop, photo, and little memory from one trip together.</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}>+ Create a journey</button>
      </section>

      {journeys.length ? (
        <div className="journey-grid">
          {journeys.map(journey => {
            const cover = findCover(journey);
            const photoCount = journey.memories.reduce((total, memory) => total + (memory.photos?.length || 0), 0);
            return (
              <article key={journey.id} className="journey-card">
                <button type="button" className="journey-card-open" onClick={() => setSelected(journey)}>
                  <div className={`journey-cover ${cover ? 'has-photo' : ''}`}>
                    {cover ? (
                      <img src={`/photos/${cover.thumbnail_path}`} alt="" />
                    ) : (
                      <div className="journey-cover-art" aria-hidden="true"><span>✦</span></div>
                    )}
                    <span className="journey-type">{journey.journey_type || 'Journey'}</span>
                  </div>
                  <div className="journey-card-copy">
                    <p>{formatJourneyDate(journey)}</p>
                    <h2>{journey.title}</h2>
                    <span>{journey.memories.length} memories · {photoCount} photos</span>
                    <strong>Open the story →</strong>
                  </div>
                </button>
                <button
                  type="button"
                  className="journey-card-edit"
                  onClick={() => { setEditing(journey); setShowForm(true); }}
                >
                  Edit
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="journeys-empty">
          <span aria-hidden="true">⌁</span>
          <h2>Turn separate stops into one story.</h2>
          <p>Your 2018 cruise is a perfect first journey: Los Angeles, Hollywood, and every port in order.</p>
          <button type="button" onClick={() => setShowForm(true)}>Create the first journey</button>
        </section>
      )}

      {showForm && <JourneyForm journey={editing} onClose={closeForm} />}
      {selected && (
        <JourneyDetail
          journey={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null); setShowForm(true); }}
          onDelete={() => removeJourney(selected)}
          onPhotos={setPhotoMemory}
        />
      )}
      {photoMemory && <MemoryPhotosModal memory={photoMemory} onClose={() => setPhotoMemory(null)} />}
    </div>
  );
}

function JourneyDetail({ journey, onClose, onEdit, onDelete, onPhotos }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1500]">
      <div className="journey-detail">
        <header>
          <div>
            <p className="memory-eyebrow">{formatJourneyDate(journey)}</p>
            <h2>{journey.title}</h2>
            <p>{journey.summary || 'A collection of places that belong to one adventure.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close journey">✕</button>
        </header>

        {journey.memories.some(memory => memory.latitude && memory.longitude) && (
          <div className="journey-map">
            <MapView trips={journey.memories} compact />
          </div>
        )}

        <div className="journey-timeline">
          {journey.memories.map((memory, index) => (
            <article key={memory.id}>
              <div className="journey-stop-number">{index + 1}</div>
              <div className="journey-stop-copy">
                <p>{formatMemoryDate(memory)}</p>
                <h3>{memory.location_name}</h3>
                <span>{[memory.city, memory.state, memory.country].filter(Boolean).join(', ')}</span>
                {memory.notes && <blockquote>{memory.notes}</blockquote>}
                {memory.photos?.length > 0 && (
                  <div className="journey-photo-strip">
                    {memory.photos.slice(0, 4).map(photo => (
                      <img key={photo.id} src={`/photos/${photo.thumbnail_path}`} alt={photo.filename} />
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => onPhotos(memory)}>
                  {memory.photos?.length ? `View or add photos (${memory.photos.length})` : '+ Add photos'}
                </button>
              </div>
            </article>
          ))}
          {!journey.memories.length && <div className="memory-empty">No memories have been added to this journey yet.</div>}
        </div>

        <footer>
          <button type="button" onClick={onDelete}>Delete journey</button>
          <button type="button" onClick={onEdit}>Edit journey</button>
        </footer>
      </div>
    </div>
  );
}

function findCover(journey) {
  for (const memory of journey.memories) {
    if (memory.photos?.length) return memory.photos[0];
  }
  return null;
}

function formatJourneyDate(journey) {
  if (!journey.start_date) return journey.date_label || 'Dates still being remembered';
  const start = formatDateOnly(journey.start_date, { month: 'short', year: 'numeric' });
  if (!journey.end_date || journey.end_date === journey.start_date) return start;
  const end = formatDateOnly(journey.end_date, { month: 'short', year: 'numeric' });
  return start === end ? start : `${start} — ${end}`;
}

function formatMemoryDate(memory) {
  if (!memory.start_date) return memory.date_label || 'Date unknown';
  return formatDateOnly(memory.start_date, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}
