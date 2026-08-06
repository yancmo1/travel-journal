import { useState } from 'react';
import { useData } from '../context/DataContext';
import JourneyForm from '../components/JourneyForm';
import TripForm from '../components/TripForm';
import MapView from '../components/Map';
import MemoryPhotosModal from '../components/MemoryPhotosModal';
import MemoryPlaceDetails from '../components/MemoryPlaceDetails';
import { formatDateOnly } from '../utils/format';
import { getPhotoImageStyle, getPhotoPreviewPath } from '../utils/photos';
import api from '../utils/api';

export default function JourneysPage() {
  const { journeys, deleteJourney } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editTrip, setEditTrip] = useState(null);
  const [photoMemory, setPhotoMemory] = useState(null);
  const [printJourney, setPrintJourney] = useState(null);

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
          <p>Bring every stop, photo, and little memory from one journey together.</p>
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
                    {getPhotoPreviewPath(cover) ? (
                      <img src={`/photos/${getPhotoPreviewPath(cover)}`} alt="" style={getPhotoImageStyle(cover)} />
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
      {editTrip && <TripForm trip={editTrip} onClose={() => setEditTrip(null)} />}
      {selected && (
        <JourneyDetail
          journey={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null); setShowForm(true); }}
          onDelete={() => removeJourney(selected)}
          onPhotos={setPhotoMemory}
          onPrint={() => {
            setPrintJourney(selected);
            setSelected(null);
            setTimeout(() => window.print(), 50);
          }}
        />
      )}
      {photoMemory && (
        <MemoryPhotosModal
          memory={photoMemory}
          onClose={() => setPhotoMemory(null)}
          onEdit={() => { setEditTrip(photoMemory); setPhotoMemory(null); setSelected(null); }}
        />
      )}
      {printJourney && <TravelBookPrint journey={printJourney} onClose={() => setPrintJourney(null)} />}
    </div>
  );
}

function JourneyDetail({ journey, onClose, onEdit, onDelete, onPhotos, onPrint }) {
  const [shareLink, setShareLink] = useState(journey.share_token ? `${window.location.origin}/?share=${encodeURIComponent(journey.share_token)}` : '');
  const [shareError, setShareError] = useState('');
  const [sharing, setSharing] = useState(false);

  async function createShareLink() {
    setSharing(true);
    setShareError('');
    try {
      const result = await api.createJourneyShare(journey.id);
      setShareLink(`${window.location.origin}/?share=${encodeURIComponent(result.share_token)}`);
    } catch (error) {
      setShareError(error.message || 'The private link could not be created.');
    } finally {
      setSharing(false);
    }
  }

  async function revokeShareLink() {
    setSharing(true);
    setShareError('');
    try {
      await api.revokeJourneyShare(journey.id);
      setShareLink('');
    } catch (error) {
      setShareError(error.message || 'The private link could not be revoked.');
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      setShareError('Copy was blocked. Select the link and copy it manually.');
    }
  }

  return (
    <div className="journey-detail-modal fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1500]">
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
                <MemoryPlaceDetails memory={memory} className="mt-1" />
                <span>{[memory.city, memory.state, memory.country].filter(Boolean).join(', ')}</span>
                {memory.notes && <blockquote>{memory.notes}</blockquote>}
                {memory.photos?.length > 0 && (
                  <div className="journey-photo-strip">
                    {memory.photos.slice(0, 4).map(photo => (
                      getPhotoPreviewPath(photo) ? <img key={photo.id} src={`/photos/${getPhotoPreviewPath(photo)}`} alt={photo.caption || photo.filename} style={getPhotoImageStyle(photo)} /> : <div key={photo.id} className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">Processing</div>
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

        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={createShareLink} disabled={sharing} className="rounded-lg bg-ocean-teal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {sharing ? 'Working…' : shareLink ? 'Regenerate private link' : 'Create private link'}
            </button>
            {shareLink && <button type="button" onClick={copyShareLink} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600">Copy link</button>}
            {shareLink && <button type="button" onClick={revokeShareLink} disabled={sharing} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">Revoke</button>}
          </div>
          {shareLink && <input readOnly value={shareLink} aria-label="Private journey link" className="mt-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600" onFocus={event => event.target.select()} />}
          {shareError && <p className="mt-2 text-sm text-red-600" role="alert">{shareError}</p>}
        </div>
        <footer>
          <button type="button" onClick={onDelete}>Delete journey</button>
          <button type="button" onClick={onPrint}>Print / save as PDF</button>
          <button type="button" onClick={onEdit}>Edit journey</button>
        </footer>
      </div>
    </div>
  );
}

function findCover(journey) {
  if (journey.cover_photo_id) {
      const selected = journey.memories.flatMap(memory => memory.photos || [])
      .find(photo => String(photo.id) === String(journey.cover_photo_id) && getPhotoPreviewPath(photo));
    if (selected) return selected;
  }
  for (const memory of journey.memories) {
    const cover = memory.photos?.find(photo => photo.is_cover && getPhotoPreviewPath(photo));
    if (cover) return cover;
  }
  for (const memory of journey.memories) {
    const firstReady = memory.photos?.find(photo => getPhotoPreviewPath(photo));
    if (firstReady) return firstReady;
  }
  return null;
}

function TravelBookPrint({ journey, onClose }) {
  const cover = findCover(journey);

  return (
    <section className="travel-book-print" aria-label="Printable travel book">
      <div className="travel-book-actions">
        <button type="button" onClick={() => window.print()}>Print / save as PDF</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <header>
        {cover && <img src={`/photos/${cover.file_path || cover.thumbnail_path}`} alt="" style={getPhotoImageStyle(cover)} />}
        <div>
          <p>{formatJourneyDate(journey)}</p>
          <h1>{journey.title}</h1>
          <blockquote>{journey.summary || 'A family travel story.'}</blockquote>
        </div>
      </header>
      {journey.memories.map((memory, index) => (
        <article key={memory.id}>
              <div className="travel-book-memory-heading">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>{formatMemoryDate(memory)}</p>
                  <h2>{memory.location_name}</h2>
                  <MemoryPlaceDetails memory={memory} className="mt-1" />
                  <small>{[memory.city, memory.state, memory.country].filter(Boolean).join(', ')}</small>
                </div>
              </div>
          {memory.notes && <p>{memory.notes}</p>}
          {memory.photos?.length > 0 && (
            <div className="travel-book-photos">
              {memory.photos.map(photo => (
                <figure key={photo.id}>
                  <img src={`/photos/${photo.file_path || photo.thumbnail_path}`} alt={photo.caption || photo.filename || ''} style={getPhotoImageStyle(photo)} />
                  {photo.caption && <figcaption>{photo.caption}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function formatJourneyDate(journey) {
  if (!journey.start_date) return journey.date_label || 'Dates still being remembered';
  const start = formatDateOnly(journey.start_date, { month: 'short', day: 'numeric', year: 'numeric' });
  if (!journey.end_date || journey.end_date === journey.start_date) return start;
  const end = formatDateOnly(journey.end_date, { month: 'short', day: 'numeric', year: 'numeric' });
  return start === end ? start : `${start} — ${end}`;
}

function formatMemoryDate(memory) {
  if (!memory.start_date) return memory.date_label || 'Date unknown';
  return formatDateOnly(memory.start_date, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}
