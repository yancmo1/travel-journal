import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, MapPin, Calendar, Camera } from 'lucide-react';

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

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const currentPhoto = photos[currentIndex];

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextPhoto();
    if (e.key === 'ArrowLeft') prevPhoto();
  };

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            onClick={() => openLightbox(index)}
            className="relative aspect-square cursor-pointer group overflow-hidden rounded-lg
                     border-2 border-gray-200 hover:border-ocean-blue transition-all"
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
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[1500] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Previous Button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              className="absolute left-4 text-white hover:text-gray-300 z-10"
            >
              <ChevronLeft className="h-12 w-12" />
            </button>
          )}

          {/* Main Image */}
          <div 
            className="max-w-6xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/photos/${currentPhoto.file_path}`}
              alt={currentPhoto.filename}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />

            {/* Photo Info */}
            <div className="bg-gray-900/90 text-white p-4 rounded-b-lg mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{currentPhoto.filename}</h3>
                <span className="text-sm text-gray-400">
                  {currentIndex + 1} / {photos.length}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
                {currentPhoto.date_taken && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(currentPhoto.date_taken).toLocaleDateString()}</span>
                  </div>
                )}

                {currentPhoto.latitude && currentPhoto.longitude && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {currentPhoto.latitude.toFixed(4)}, {currentPhoto.longitude.toFixed(4)}
                    </span>
                  </div>
                )}

                {currentPhoto.metadata?.model && (
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <span>{currentPhoto.metadata.model}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Size:</span>
                  <span>{(currentPhoto.file_size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>

              {/* Actions */}
              {onDelete && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      if (confirm('Delete this photo?')) {
                        onDelete(currentPhoto.id);
                        closeLightbox();
                      }
                    }}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 
                             text-sm px-3 py-1 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Next Button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              className="absolute right-4 text-white hover:text-gray-300 z-10"
            >
              <ChevronRight className="h-12 w-12" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
