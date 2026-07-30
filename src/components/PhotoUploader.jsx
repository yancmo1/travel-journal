import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function PhotoUploader({ tripId, onUploadComplete, showAnalyzer = false, customUploadHandler }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFiles = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    const validFiles = fileArray.filter(file => 
      file.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      alert('Please select valid image files');
      return;
    }

    setFiles(validFiles);

    // Generate previews
    const previewPromises = validFiles.map(file => {
      return new Promise((resolve) => {
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
        alert('Failed to process photos. Please try again.');
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
      alert('Failed to upload photos. Please try again.');
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
          border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging 
            ? 'border-ocean-teal bg-ocean-teal/10' 
            : 'border-gray-300 hover:border-ocean-blue'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <Upload className={`mx-auto h-12 w-12 mb-3 ${
          isDragging ? 'text-ocean-teal' : 'text-gray-400'
        }`} />

        <p className="text-lg font-medium text-gray-700 mb-1">
          {isDragging ? 'Drop photos here' : 'Drag & drop photos here'}
        </p>
        <p className="text-sm text-gray-500">
          or click to browse • JPEG, PNG, HEIC supported
        </p>
        {showAnalyzer && (
          <p className="text-xs text-ocean-blue mt-2">
            Photos with GPS data will be analyzed for location
          </p>
        )}
      </div>

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
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
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
          onClick={uploadPhotos}
          className="w-full bg-ocean-blue hover:bg-ocean-blue/90 text-white 
                   font-medium px-6 py-3 rounded-lg transition-colors
                   flex items-center justify-center gap-2"
        >
          <Upload className="h-5 w-5" />
          {customUploadHandler
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
