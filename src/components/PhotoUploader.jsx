import { useEffect, useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../utils/api';

function isImageFile(file) {
  const extension = file.name?.split('.').pop()?.toLowerCase();
  return file.type.startsWith('image/') || extension === 'heic' || extension === 'heif';
}

function isHeicFile(file) {
  const extension = file.name?.split('.').pop()?.toLowerCase();
  return extension === 'heic' || extension === 'heif' || ['image/heic', 'image/heif'].includes(file.type.toLowerCase());
}

export default function PhotoUploader({ tripId, onUploadComplete, showAnalyzer = false, customUploadHandler }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (showAnalyzer) return undefined;
    let cancelled = false;
    api.getPhotoQuota().then(result => {
      if (!cancelled) setQuota(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [showAnalyzer, tripId]);

  // Handle file selection
  const handleFiles = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    const validFiles = fileArray.filter(isImageFile);

    if (validFiles.length === 0) {
      setError('Please choose one or more image files. JPEG, PNG, and HEIC are supported.');
      return;
    }

    setError(fileArray.length !== validFiles.length
      ? `${fileArray.length - validFiles.length} file${fileArray.length - validFiles.length === 1 ? '' : 's'} skipped because it was not an image.`
      : '');
    setUploadResults(null);
    setFiles(validFiles);

    // Generate previews
    const previewPromises = validFiles.map(file => {
      return new Promise((resolve) => {
        if (isHeicFile(file)) {
          resolve({
            file,
            url: null,
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            heic: true,
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => resolve({
          file,
          url: e.target.result,
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
        });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then(setPreviews);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  // Remove file from selection
  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  // Upload files
  const uploadPhotos = async () => {
    if (files.length === 0) return;

    setError('');
    setUploading(true);
    setProgress(0);

    // Use custom handler if provided (for analyzer)
    if (customUploadHandler) {
      try {
        await customUploadHandler(files);
        setProgress(100);
        
        // Clear files after successful analysis
        setTimeout(() => {
          setFiles([]);
          setPreviews([]);
        }, 500);
      } catch (error) {
        console.error('Custom handler error:', error);
        setError('We couldn’t process these photos. Your selection is still here; check the files and try again.');
      } finally {
        setUploading(false);
      }
      return;
    }

    try {
      const result = await api.uploadPhotos(tripId, files);
      setUploadResults(result);
      setProgress(100);

      // Clear files after successful upload
      setTimeout(() => {
        setFiles([]);
        setPreviews([]);
        setUploadResults(null);
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setError('We couldn’t save these photos. Your selection is still here; check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg transition-all
          ${showAnalyzer ? 'p-8 text-center' : 'flex items-center gap-3 px-4 py-3 text-left'}
          ${isDragging 
            ? 'border-ocean-teal bg-ocean-teal/10' 
            : 'border-gray-300 bg-gray-50/60 hover:border-ocean-blue hover:bg-ocean-blue/5'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <Upload className={`${showAnalyzer ? 'mx-auto mb-3 h-12 w-12' : 'h-6 w-6 shrink-0'} ${
          isDragging ? 'text-ocean-teal' : 'text-gray-400'
        }`} />

        <div className="min-w-0">
          <p className={`${showAnalyzer ? 'mb-1 text-lg' : 'text-sm'} font-medium text-gray-700`}>
            {isDragging ? 'Drop photos here' : showAnalyzer ? 'Drag & drop photos here' : 'Add photos'}
          </p>
          <p className={`${showAnalyzer ? 'text-sm' : 'text-xs'} text-gray-500`}>
            {showAnalyzer ? 'or click to browse' : 'Drop here or click to choose'} • JPEG, PNG, HEIC
          </p>
          {showAnalyzer && (
            <p className="mt-2 text-xs text-ocean-blue">
              Photos with GPS data will be analyzed for location
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="min-h-11 rounded-lg border border-ocean-teal/30 bg-white px-3 py-2 text-xs font-semibold text-ocean-dark hover:bg-ocean-teal/5 disabled:opacity-50"
            >
              Take a photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-ocean-blue hover:text-ocean-dark disabled:opacity-50"
            >
              Choose from library
            </button>
          </div>
        </div>
      </div>

      {quota?.warning && (
        <div className={`rounded-lg border p-3 text-sm ${quota.blocked ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role="status">
          {quota.blocked
            ? 'This memory site has reached its photo storage allowance. Remove older photos before adding more.'
            : `This memory site is using ${quota.storage_usage_percent}% of its photo storage allowance.`}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="polite">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{error}</p>
            {files.length > 0 && <p className="mt-1 text-xs text-red-600">Use the retry button below; you won’t need to select the photos again.</p>}
          </div>
        </div>
      )}

      {/* Preview Grid */}
      {previews.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              Selected Photos ({previews.length})
            </h4>
            <button
              onClick={() => {
                setFiles([]);
                setPreviews([]);
              }}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                {preview.url ? (
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="w-full h-24 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ocean-teal/40 bg-ocean-teal/10 px-2 text-center text-ocean-dark">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">HEIC</span>
                    <span className="text-[9px] leading-tight">Converts to JPEG on upload</span>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 
                           opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white 
                              text-xs p-1 rounded-b-lg truncate">
                  {preview.size}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && !uploading && !uploadResults && (
        <button
          type="button"
          onClick={uploadPhotos}
          className="w-full bg-ocean-blue hover:bg-ocean-blue/90 text-white 
                   font-medium px-6 py-3 rounded-lg transition-colors
                   flex items-center justify-center gap-2"
        >
          <Upload className="h-5 w-5" />
          {error
            ? 'Retry'
            : customUploadHandler
            ? `Analyze ${files.length} Photo${files.length > 1 ? 's' : ''}`
            : `Save ${files.length} Photo${files.length > 1 ? 's' : ''}`
          }
        </button>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{customUploadHandler ? 'Analyzing...' : 'Saving smaller copies...'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-ocean-blue transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Successfully uploaded {uploadResults.count} photo{uploadResults.count > 1 ? 's' : ''}!
            </span>
          </div>
          {uploadResults.photos.some(p => p.hasGPS) && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {uploadResults.photos.filter(p => p.hasGPS).length} photo(s) have GPS data
            </p>
          )}
        </div>
      )}
    </div>
  );
}
