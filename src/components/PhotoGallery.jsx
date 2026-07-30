import { useState } from 'react';
import { Trash2, MapPin, Calendar, Camera } from 'lucide-react';
import PhotoLightbox from './PhotoLightbox';

export default function PhotoGallery({ photos = [], onDelete }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-500">No photos yet</p>
        <p className="text-sm text-gray-400 mt-1">Upload photos to see them here</p>
      </div>
    );
  }

  const openLightbox = (index) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            onClick={() => openLightbox(index)}
            className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg
                     border-2 border-gray-200 hover:border-ocean-blue transition-all"
            aria-label={`Open ${photo.filename || `photo ${index + 1}`}`}
          >
            <img
              src={`/photos/${photo.thumbnail_path}`}
              alt={photo.filename}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            
            {/* GPS Indicator */}
            {photo.latitude && photo.longitude && (
              <div className="absolute top-2 right-2 bg-ocean-teal text-white rounded-full p-1">
                <MapPin className="h-3 w-3" />
              </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 text-white text-xs
                            translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="truncate">{photo.filename}</p>
                {photo.date_taken && (
                  <p className="text-gray-300 text-[10px]">
                    {new Date(photo.date_taken).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          photos={photos}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setLightboxOpen(false)}
          footer={photo => (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-300">
              <div className="flex flex-wrap items-center gap-4">
                {photo.date_taken && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(photo.date_taken).toLocaleDateString()}
                  </span>
                )}
                {photo.latitude && photo.longitude && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {Number(photo.latitude).toFixed(4)}, {Number(photo.longitude).toFixed(4)}
                  </span>
                )}
                {photo.metadata?.model && (
                  <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {photo.metadata.model}
                  </span>
                )}
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this photo?')) {
                      onDelete(photo.id);
                      setLightboxOpen(false);
                    }
                  }}
                  className="flex items-center gap-2 rounded px-3 py-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        />
      )}
    </>
  );
}
