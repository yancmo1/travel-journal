import { useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, Camera, GripVertical, MapPin, RotateCw, Save, Star, Trash2 } from 'lucide-react';
import PhotoLightbox from './PhotoLightbox';
import { getPhotoImageStyle, nextPhotoRotation } from '../utils/photos';

export default function PhotoGallery({ photos = [], onDelete, onUpdate, onReorder }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draggedPhotoId, setDraggedPhotoId] = useState(null);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkCaptionOpen, setBulkCaptionOpen] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);

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

  function reorderPhotos(targetId) {
    if (!onReorder || draggedPhotoId === null || draggedPhotoId === targetId) return;

    const nextPhotos = [...photos];
    const sourceIndex = nextPhotos.findIndex(photo => photo.id === draggedPhotoId);
    const targetIndex = nextPhotos.findIndex(photo => photo.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [movedPhoto] = nextPhotos.splice(sourceIndex, 1);
    nextPhotos.splice(targetIndex, 0, movedPhoto);
    onReorder(nextPhotos.map(photo => photo.id));
    setDraggedPhotoId(null);
  }

  function movePhoto(photoId, direction) {
    if (!onReorder) return;
    const currentIndex = photos.findIndex(photo => photo.id === photoId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= photos.length) return;

    const nextPhotos = [...photos];
    [nextPhotos[currentIndex], nextPhotos[targetIndex]] = [nextPhotos[targetIndex], nextPhotos[currentIndex]];
    onReorder(nextPhotos.map(photo => photo.id));
  }

  function captionFor(photo) {
    return captionDrafts[photo.id] ?? photo.caption ?? '';
  }

  function updateCaptionDraft(photo, value) {
    setCaptionDrafts(current => ({ ...current, [photo.id]: value }));
  }

  function saveCaption(photo) {
    if (!onUpdate) return;
    onUpdate(photo.id, { caption: captionFor(photo) });
  }

  function toggleSelected(id) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function rotateSelected() {
    if (!onUpdate || !selectedIds.size) return;
    setBulkWorking(true);
    await Promise.all(photos.filter(photo => selectedIds.has(photo.id)).map(photo => onUpdate(photo.id, { rotation: nextPhotoRotation(photo) })));
    setBulkWorking(false);
  }

  async function saveBulkCaption() {
    if (!onUpdate || !selectedIds.size) return;
    setBulkWorking(true);
    await Promise.all([...selectedIds].map(id => onUpdate(id, { caption: bulkCaption })));
    setBulkCaptionOpen(false);
    setBulkWorking(false);
  }

  return (
    <>
      <p className="mb-3 text-xs text-gray-500">
        {onReorder ? 'Drag photos to reorder them. The cover photo appears first.' : 'Select a photo to view it full-screen.'}
      </p>
      {onUpdate && (
        <div className="mb-3 rounded-xl border border-ocean-teal/15 bg-ocean-teal/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => setSelectedIds(selectedIds.size === photos.length ? new Set() : new Set(photos.map(photo => photo.id)))} className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-700">
              {selectedIds.size === photos.length ? 'Clear selection' : 'Select all'}
            </button>
            <span className="text-gray-600">{selectedIds.size} selected</span>
            {selectedIds.size > 0 && <>
              <button type="button" onClick={rotateSelected} disabled={bulkWorking} className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-700 disabled:opacity-50">Rotate selected</button>
              <button type="button" onClick={() => setBulkCaptionOpen(current => !current)} disabled={bulkWorking} className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-700 disabled:opacity-50">Bulk caption</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg px-3 py-2 text-gray-500">Done</button>
            </>}
          </div>
          {bulkCaptionOpen && selectedIds.size > 0 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={bulkCaption} onChange={event => setBulkCaption(event.target.value)} placeholder="Caption for every selected photo" maxLength={2000} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2" />
              <button type="button" onClick={saveBulkCaption} disabled={bulkWorking} className="rounded-lg bg-ocean-blue px-3 py-2 font-semibold text-white disabled:opacity-50">{bulkWorking ? 'Saving…' : 'Apply caption'}</button>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            draggable={Boolean(onReorder)}
            onDragStart={() => setDraggedPhotoId(photo.id)}
            onDragEnd={() => setDraggedPhotoId(null)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => reorderPhotos(photo.id)}
            className={`relative overflow-hidden rounded-lg border-2 border-gray-200 transition-all ${
              draggedPhotoId === photo.id ? 'opacity-50' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => openLightbox(index)}
              className="relative block aspect-square w-full cursor-pointer group overflow-hidden hover:border-ocean-blue"
              aria-label={`Open ${photo.filename || `photo ${index + 1}`}`}
            >
              {photo.thumbnail_path ? (
                <img
                  src={`/photos/${photo.thumbnail_path}`}
                  alt={photo.caption || photo.filename || ''}
                  style={getPhotoImageStyle(photo)}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center text-xs font-semibold text-slate-600">
                  <span aria-hidden="true">◌</span>
                  <span>{photo.processing_status === 'processing_failed' ? 'Processing failed' : 'Processing pending'}</span>
                </div>
              )}

              {photo.is_cover && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-semibold text-amber-950 shadow">
                  <Star className="h-3 w-3 fill-current" /> Cover
                </span>
              )}

              {photo.processing_status && photo.processing_status !== 'ready' && (
                <span className="absolute left-2 bottom-10 rounded-full bg-black/75 px-2 py-1 text-[10px] font-semibold text-white">
                  {photo.processing_status === 'processing_failed' ? 'Processing failed' : 'Processing pending'}
                </span>
              )}

              {photo.latitude !== null && photo.latitude !== undefined && photo.longitude !== null && photo.longitude !== undefined && (
                <span className="absolute right-2 top-2 rounded-full bg-ocean-teal p-1 text-white">
                  <MapPin className="h-3 w-3" />
                </span>
              )}

              <span className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-left text-xs text-white">
                <span className="block truncate">{photo.caption || photo.filename}</span>
                {photo.date_taken && (
                  <span className="block text-[10px] text-gray-300">
                    {new Date(photo.date_taken).toLocaleDateString()}
                  </span>
                )}
              </span>
            </button>

            {onUpdate && (
              <label className="absolute left-2 bottom-2 z-10 flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg bg-black/70 p-1.5 text-white shadow" onClick={event => event.stopPropagation()}>
                <input type="checkbox" checked={selectedIds.has(photo.id)} onChange={() => toggleSelected(photo.id)} aria-label={`Select ${photo.filename || `photo ${index + 1}`} for bulk editing`} className="h-4 w-4" />
              </label>
            )}

            {onUpdate && (
              <div className="flex items-center justify-between gap-1 border-t border-gray-100 bg-white px-2 py-1">
                {onReorder && (
                  <div className="flex items-center gap-0.5 text-gray-400">
                    <span title="Drag to reorder" aria-label="Drag to reorder">
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => movePhoto(photo.id, -1)}
                      disabled={index === 0}
                      className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"
                      aria-label={`Move ${photo.filename || `photo ${index + 1}`} earlier`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(photo.id, 1)}
                      disabled={index === photos.length - 1}
                      className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"
                      aria-label={`Move ${photo.filename || `photo ${index + 1}`} later`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onUpdate(photo.id, { isCover: true })}
                  className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium ${photo.is_cover ? 'text-amber-700' : 'text-gray-500 hover:text-amber-700'}`}
                  aria-label={photo.is_cover ? 'Current cover photo' : `Make ${photo.filename || `photo ${index + 1}`} the cover photo`}
                >
                  <Star className={`h-3 w-3 ${photo.is_cover ? 'fill-current' : ''}`} />
                  {photo.is_cover ? 'Cover' : 'Set cover'}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(photo.id, { rotation: nextPhotoRotation(photo) })}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-gray-500 hover:text-ocean-blue"
                  aria-label={`Rotate ${photo.filename || `photo ${index + 1}`}`}
                >
                  <RotateCw className="h-3 w-3" /> Rotate
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          photos={photos}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setLightboxOpen(false)}
          footer={photo => (
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex flex-wrap items-center gap-4">
                {photo.caption && <p className="basis-full text-white">{photo.caption}</p>}
                {photo.date_taken && (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(photo.date_taken).toLocaleDateString()}
                  </span>
                )}
                {photo.latitude !== null && photo.latitude !== undefined && photo.longitude !== null && photo.longitude !== undefined && (
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

              {onUpdate && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[min(18rem,100%)] flex-1">
                    <span className="mb-1 block text-xs text-gray-400">Caption</span>
                    <input
                      type="text"
                      value={captionFor(photo)}
                      onChange={event => updateCaptionDraft(photo, event.target.value)}
                      placeholder="Add a short caption"
                      maxLength={2000}
                      className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-gray-500"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveCaption(photo)}
                    className="flex items-center gap-1 rounded bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                  >
                    <Save className="h-4 w-4" /> Save caption
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(photo.id, { rotation: nextPhotoRotation(photo) })}
                    className="flex items-center gap-1 rounded bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                  >
                    <RotateCw className="h-4 w-4" /> Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(photo.id, { isCover: true })}
                    className="flex items-center gap-1 rounded bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                  >
                    <Star className={`h-4 w-4 ${photo.is_cover ? 'fill-current text-amber-300' : ''}`} />
                    {photo.is_cover ? 'Cover photo' : 'Make cover'}
                  </button>
                </div>
              )}

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
