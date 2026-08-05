import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import PhotoUploader from './PhotoUploader';
import PhotoGallery from './PhotoGallery';
import MemoryPlaceDetails from './MemoryPlaceDetails';

export default function MemoryPhotosModal({ memory, onClose }) {
  const { loadTrips, loadJourneys } = useData();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  async function loadPhotos() {
    setLoading(true);
    try {
      setPhotos(await api.getAllPhotos(memory.id));
    } catch (error) {
      setActionError(error.message || 'Saved photos could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, [memory.id]);

  async function handleUploadComplete() {
    try {
      await Promise.all([loadPhotos(), loadTrips(), loadJourneys()]);
    } catch {
      setActionError('Photos uploaded, but the gallery could not refresh. Close and reopen this memory to check.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.deletePhoto(id);
      await Promise.all([loadPhotos(), loadTrips(), loadJourneys()]);
    } catch (error) {
      setActionError(error.message || 'Photo could not be deleted. Please try again.');
    }
  }

  async function handleUpdate(id, changes) {
    try {
      const updated = await api.updatePhoto(id, changes);
      setPhotos(current => current.map(photo => {
        if (photo.id === updated.id) return updated;
        return changes.isCover ? { ...photo, is_cover: false } : photo;
      }));
      await Promise.all([loadTrips(), loadJourneys()]);
    } catch (error) {
      setActionError(error.message || 'Photo details could not be saved. Please try again.');
    }
  }

  async function handleReorder(photoIds) {
    const byId = new Map(photos.map(photo => [photo.id, photo]));
    setPhotos(photoIds.map(id => byId.get(id)).filter(Boolean));

    try {
      const saved = await api.reorderPhotos(memory.id, photoIds);
      setPhotos(saved);
      await Promise.all([loadTrips(), loadJourneys()]);
    } catch (error) {
      setActionError(error.message || 'Photo order could not be saved. Please try again.');
      await loadPhotos();
    }
  }

  return (
    <div className="memory-photos-modal fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1600]">
      <div className="memory-photos-shell bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[94vh] overflow-auto">
        <div className="photo-modal-heading">
          <div>
            <p className="memory-eyebrow">Photos from</p>
            <h2>{memory.location_name}</h2>
            <MemoryPlaceDetails memory={memory} className="mt-2" />
            <p>We save smaller, display-quality copies to keep storage reasonable.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close photos">✕</button>
        </div>

        <div className="photo-modal-body">
          <div>
            <div className="photo-section-title">
              <h3>{photos.length ? `${photos.length} saved photo${photos.length === 1 ? '' : 's'}` : 'Saved photos'}</h3>
            </div>
            {actionError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                {actionError}
              </div>
            )}
            {loading ? (
              <div className="memory-empty">Loading photos…</div>
            ) : (
              <PhotoGallery
                photos={photos}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onReorder={handleReorder}
              />
            )}
          </div>
          <div className="border-t border-gray-100 pt-4">
            <PhotoUploader tripId={memory.id} onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      </div>
    </div>
  );
}
