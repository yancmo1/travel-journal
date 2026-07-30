import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';

const ZOOM_STEPS = [1, 1.5, 2];

export default function PhotoLightbox({
  photos,
  currentIndex,
  onIndexChange,
  onClose,
  footer,
}) {
  const [zoom, setZoom] = useState(1);
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && photos.length > 1) {
        onIndexChange((currentIndex + 1) % photos.length);
      }
      if (event.key === 'ArrowLeft' && photos.length > 1) {
        onIndexChange((currentIndex - 1 + photos.length) % photos.length);
      }
      if (event.key === '+' || event.key === '=') changeZoom(1);
      if (event.key === '-') changeZoom(-1);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, onClose, onIndexChange, photos.length]);

  function changeZoom(direction) {
    setZoom(current => {
      const currentStep = ZOOM_STEPS.indexOf(current);
      const nextStep = Math.min(
        ZOOM_STEPS.length - 1,
        Math.max(0, currentStep + direction)
      );
      return ZOOM_STEPS[nextStep];
    });
  }

  function showPrevious() {
    onIndexChange((currentIndex - 1 + photos.length) % photos.length);
  }

  function showNext() {
    onIndexChange((currentIndex + 1) % photos.length);
  }

  if (!currentPhoto) return null;

  const imagePath = currentPhoto.file_path || currentPhoto.thumbnail_path;

  return (
    <div
      className="fixed inset-0 z-[1900] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer: ${currentPhoto.filename || 'memory photo'}`}
      onClick={onClose}
    >
      <div className="relative z-20 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{currentPhoto.filename || 'Memory photo'}</p>
          <p className="text-xs text-gray-400">
            {currentIndex + 1} of {photos.length} · {Math.round(zoom * 100)}%
          </p>
        </div>
        <div className="flex items-center gap-1" onClick={event => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={zoom === ZOOM_STEPS[0]}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
            aria-label="Zoom out"
          >
            <Minus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"
            aria-label="Zoom in"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-lg p-2 hover:bg-white/10"
            aria-label="Close photo viewer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto" onClick={event => event.stopPropagation()}>
        <div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
          <img
            src={`/photos/${imagePath}`}
            alt={currentPhoto.filename || 'Memory photo'}
            onClick={() => setZoom(current => current === 1 ? 2 : 1)}
            className={`rounded-lg select-none ${zoom === 1 ? 'max-h-[78vh] max-w-full cursor-zoom-in object-contain' : 'max-w-none cursor-zoom-out'}`}
            style={zoom === 1 ? undefined : { width: `${zoom * 90}vw`, height: 'auto' }}
          />
        </div>
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); showPrevious(); }}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 sm:left-5"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-8 w-8 sm:h-10 sm:w-10" />
          </button>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); showNext(); }}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 sm:right-5"
            aria-label="Next photo"
          >
            <ChevronRight className="h-8 w-8 sm:h-10 sm:w-10" />
          </button>
        </>
      )}

      {footer && (
        <div
          className="relative z-20 border-t border-white/10 bg-black/70 px-4 py-2"
          onClick={event => event.stopPropagation()}
        >
          {footer(currentPhoto)}
        </div>
      )}
    </div>
  );
}
