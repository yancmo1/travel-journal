import { useState } from 'react';
import { Upload, Sparkles, MapPin, Calendar, Image, CheckCircle, AlertTriangle } from 'lucide-react';
import PhotoUploader from '../components/PhotoUploader';

export default function PhotoAnalyzerPage({ setPage }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [creatingTrips, setCreatingTrips] = useState(false);
  const [editedSuggestions, setEditedSuggestions] = useState({});

  const handleAnalyze = async (files) => {
    setAnalyzing(true);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch('/api/photos/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('travel_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const results = await response.json();
      setAnalysisResults(results);
      
      // Auto-select all high confidence suggestions
      const autoSelect = results.suggestedTrips
        .map((_, index) => index)
        .filter((_, index) => results.suggestedTrips[index].confidence >= 70);
      setSelectedSuggestions(autoSelect);

      // Initialize edited suggestions state
      const edits = {};
      results.suggestedTrips.forEach((sugg, i) => {
        edits[i] = {
          locationName: sugg.suggestedLocation || '',
          startDate: sugg.startDate || '',
          endDate: sugg.endDate || '',
          tripType: sugg.suggestedTripType || 'Road Trip'
        };
      });
      setEditedSuggestions(edits);

    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze photos. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSuggestion = (index) => {
    setSelectedSuggestions(prev => 
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const tripTypes = ['Road Trip','Flight','Cruise','Day Trip','Other'];

  const setEditField = (index, field, value) => {
    setEditedSuggestions(prev => ({
      ...prev,
      [index]: {
        ...(prev[index] || {}),
        [field]: value
      }
    }));
  };

  const createTripsFromSuggestions = async () => {
    setCreatingTrips(true);

    try {
      // Create each trip using selected suggestion indices so we keep edits aligned
      for (const idx of selectedSuggestions) {
        const suggestion = analysisResults.suggestedTrips[idx];
        const edits = editedSuggestions[idx] || {};
        const tripData = {
          locationName: edits.locationName || suggestion.suggestedLocation,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          country: suggestion.locationDetails?.country || null,
          state: suggestion.locationDetails?.state || null,
          startDate: edits.startDate || suggestion.startDate,
          endDate: edits.endDate || suggestion.endDate,
          tripType: edits.tripType || suggestion.suggestedTripType,
          notes: suggestion.notes,
          homeDistance: null // Will be calculated server-side
        };

        const photoFilenames = suggestion.photos.map(p => p.tempFilename);

        await fetch('/api/photos/create-from-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('travel_token')}`
          },
          body: JSON.stringify({ tripData, photoFilenames })
        });
      }

      alert(`Successfully created ${selectedTrips.length} trip(s)!`);
      if (setPage) {
        setPage('trips');
      }

    } catch (error) {
      console.error('Trip creation error:', error);
      alert('Failed to create trips. Please try again.');
    } finally {
      setCreatingTrips(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-10 w-10 text-ocean-blue" />
            <h1 className="text-4xl font-bold text-gray-900">Photo Intelligence</h1>
          </div>
          <p className="text-lg text-gray-600">
            Upload photos and we'll automatically suggest trips based on GPS data and dates
          </p>
        </div>

        {/* Upload Section */}
        {!analysisResults && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Photos</h2>
            <PhotoUploader 
              showAnalyzer={true}
              tripId={null}
              customUploadHandler={handleAnalyze}
            />
          </div>
        )}

        {/* Analyzing State */}
        {analyzing && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-ocean-blue border-t-transparent mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-gray-900">Analyzing Photos...</h3>
            <p className="text-gray-600 mt-2">Extracting GPS data, dates, and clustering trips</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResults && !analyzing && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analysis Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <Image className="h-8 w-8 text-ocean-blue mb-2" />
                  <div className="text-3xl font-bold text-ocean-blue">{analysisResults.totalPhotos}</div>
                  <div className="text-sm text-gray-600">Total Photos</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <MapPin className="h-8 w-8 text-green-600 mb-2" />
                  <div className="text-3xl font-bold text-green-600">{analysisResults.validPhotos}</div>
                  <div className="text-sm text-gray-600">With GPS Data</div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <Sparkles className="h-8 w-8 text-purple-600 mb-2" />
                  <div className="text-3xl font-bold text-purple-600">{analysisResults.suggestedTrips.length}</div>
                  <div className="text-sm text-gray-600">Suggested Trips</div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mb-2" />
                  <div className="text-3xl font-bold text-orange-600">{analysisResults.photosWithoutMetadata}</div>
                  <div className="text-sm text-gray-600">Missing Data</div>
                </div>
              </div>
            </div>

            {/* Suggested Trips */}
            {analysisResults.suggestedTrips.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Suggested Trips</h3>
                
                <div className="space-y-4">
                  {analysisResults.suggestedTrips.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => toggleSuggestion(index)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedSuggestions.includes(index)
                          ? 'border-ocean-blue bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 flex gap-4">
                          {/* Thumbnail */}
                          <div className="w-28 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            {suggestion.photos && suggestion.photos[0] ? (
                              <img
                                src={`/api/photos/temp/${suggestion.photos[0].tempFilename}`}
                                alt={suggestion.photos[0].filename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No image</div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <input
                                type="text"
                                value={editedSuggestions[index]?.locationName ?? suggestion.suggestedLocation}
                                onChange={(e) => setEditField(index, 'locationName', e.target.value)}
                                className="text-lg font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-ocean-blue"
                              />
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                suggestion.confidence >= 80 ? 'bg-green-100 text-green-700' :
                                suggestion.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {suggestion.confidence}% Confidence
                              </span>
                              <span className="px-2 py-1 rounded text-xs font-medium bg-ocean-blue/10 text-ocean-blue">
                                {suggestion.suggestedTripType}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                              <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1 flex items-center gap-2"><Calendar className="h-4 w-4" /> Dates</label>
                                <div className="flex gap-2">
                                  <input type="date" value={editedSuggestions[index]?.startDate ?? suggestion.startDate} onChange={(e) => setEditField(index, 'startDate', e.target.value)} className="text-sm p-1 border rounded" />
                                  <input type="date" value={editedSuggestions[index]?.endDate ?? suggestion.endDate} onChange={(e) => setEditField(index, 'endDate', e.target.value)} className="text-sm p-1 border rounded" />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Image className="h-4 w-4" />
                                {suggestion.photoCount} photo{suggestion.photoCount > 1 ? 's' : ''}
                              </div>

                              <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1 flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</label>
                                <div className="text-sm text-gray-600">{suggestion.latitude.toFixed(4)}, {suggestion.longitude.toFixed(4)}</div>
                              </div>

                              <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1">Type</label>
                                <select value={editedSuggestions[index]?.tripType ?? suggestion.suggestedTripType} onChange={(e) => setEditField(index, 'tripType', e.target.value)} className="text-sm p-1 border rounded">
                                  {tripTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                            </div>

                          {suggestion.notes && (
                            <p className="text-sm text-gray-500 italic">{suggestion.notes}</p>
                          )}
                        </div>
                        </div>

                        <div className="ml-4">
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            selectedSuggestions.includes(index)
                              ? 'bg-ocean-blue border-ocean-blue'
                              : 'border-gray-300'
                          }`}>
                            {selectedSuggestions.includes(index) && (
                              <CheckCircle className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={createTripsFromSuggestions}
                    disabled={selectedSuggestions.length === 0 || creatingTrips}
                    className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90 disabled:bg-gray-300 
                             text-white font-medium px-6 py-3 rounded-lg transition-colors
                             flex items-center justify-center gap-2"
                  >
                    {creatingTrips ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Creating Trips...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Create {selectedSuggestions.length} Selected Trip{selectedSuggestions.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setAnalysisResults(null);
                      setSelectedSuggestions([]);
                    }}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg
                             hover:bg-gray-50 transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}

            {/* No Suggestions */}
            {analysisResults.suggestedTrips.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-yellow-600 mb-3" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Trips Detected</h3>
                <p className="text-gray-600">
                  Photos need GPS coordinates and date/time data for automatic trip detection.
                  You can still add trips manually and upload these photos later.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
