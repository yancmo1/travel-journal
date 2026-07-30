import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import PhotoUploader from './PhotoUploader';
import PhotoGallery from './PhotoGallery';

export default function MemoryPhotosModal({ memory, onClose }) {
  const { loadTrips, loadJourneys } = useData();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadPhotos() {
    setLoading(true);
    try {
      setPhotos(await api.getPhotos(memory.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, [memory.id]);

  async function handleUploadComplete() {
    await Promise.all([loadPhotos(), loadTrips(), loadJourneys()]);
  }

  async function handleDelete(id) {
    await api.deletePhoto(id);
    await Promise.all([loadPhotos(), loadTrips(), loadJourneys()]);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1600]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] overflow-auto">
        <div className="photo-modal-heading">
          <div>
            <p className="memory-eyebrow">Photos from</p>
            <h2>{memory.location_name}</h2>
            <p>We save smaller, display-quality copies to keep storage reasonable.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close photos">✕</button>
        </div>

        <div className="photo-modal-body">
          <PhotoUploader tripId={memory.id} onUploadComplete={handleUploadComplete} />
          <div>
            <div className="photo-section-title">
              <h3>{photos.length ? `${photos.length} saved photo${photos.length === 1 ? '' : 's'}` : 'Saved photos'}</h3>
            </div>
            {loading ? (
              <div className="memory-empty">Loading photos…</div>
            ) : (
              <PhotoGallery photos={photos} onDelete={handleDelete} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
