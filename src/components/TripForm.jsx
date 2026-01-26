import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { nominatimSearch, reverseGeocode } from '../utils/geocoding';

const TRIP_TYPES = ['Road Trip', 'Flight', 'Cruise', 'Day Trip', 'Other'];

export default function TripForm({ trip, onClose }) {
  const { travelers, addTrip, updateTrip, addTraveler } = useData();
  
  const [form, setForm] = useState({
    locationName: '',
    latitude: null,
    longitude: null,
    country: '',
    state: '',
    startDate: '',
    endDate: '',
    tripType: 'Other',
    notes: '',
    travelerIds: [],
  });
  
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewTraveler, setShowNewTraveler] = useState(false);
  const [newTraveler, setNewTraveler] = useState({ name: '', relationship: 'child' });

  useEffect(() => {
    if (trip) {
      setForm({
        locationName: trip.location_name || '',
        latitude: trip.latitude,
        longitude: trip.longitude,
        country: trip.country || '',
        state: trip.state || '',
        startDate: trip.start_date ? trip.start_date.split('T')[0] : '',
        endDate: trip.end_date ? trip.end_date.split('T')[0] : '',
        tripType: trip.trip_type || 'Other',
        notes: trip.notes || '',
        travelerIds: trip.travelers?.map(t => t.id) || [],
      });
    }
  }, [trip]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleTravelerToggle(id) {
    setForm(prev => ({
      ...prev,
      travelerIds: prev.travelerIds.includes(id)
        ? prev.travelerIds.filter(t => t !== id)
        : [...prev.travelerIds, id]
    }));
  }

  async function handleSearch() {
    if (!form.locationName.trim()) return;
    
    setSearching(true);
    setError('');
    
    try {
      const results = await nominatimSearch(form.locationName);
      setSearchResults(results.slice(0, 5));
    } catch (err) {
      setError('Location search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(result) {
    // Parse address components
    const parts = result.display_name.split(', ');
    let country = '';
    let state = '';
    
    if (parts.length > 0) {
      country = parts[parts.length - 1];
    }
    if (parts.length > 2) {
      state = parts[parts.length - 2];
    }

    setForm(prev => ({
      ...prev,
      locationName: parts.slice(0, 2).join(', '),
      latitude: result.lat,
      longitude: result.lng,
      country,
      state,
    }));
    setSearchResults([]);
  }

  async function handleAddTraveler() {
    if (!newTraveler.name.trim()) return;
    
    try {
      const created = await addTraveler(newTraveler);
      setForm(prev => ({
        ...prev,
        travelerIds: [...prev.travelerIds, created.id]
      }));
      setNewTraveler({ name: '', relationship: 'child' });
      setShowNewTraveler(false);
    } catch (err) {
      setError('Failed to add traveler');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.locationName.trim()) {
      setError('Location is required');
      return;
    }
    if (!form.startDate) {
      setError('Start date is required');
      return;
    }

    setSaving(true);

    try {
      const data = {
        locationName: form.locationName,
        latitude: form.latitude,
        longitude: form.longitude,
        country: form.country,
        state: form.state,
        startDate: form.startDate,
        endDate: form.endDate || null,
        tripType: form.tripType,
        notes: form.notes,
        travelerIds: form.travelerIds,
      };

      if (trip) {
        await updateTrip(trip.id, data);
      } else {
        await addTrip(data);
      }
      
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1500]">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-ocean-blue to-ocean-dark rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {trip ? 'Edit Trip' : 'Add New Trip'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Location Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="locationName"
                value={form.locationName}
                onChange={handleChange}
                placeholder="City, State or Country"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 bg-ocean-teal text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                {searching ? '...' : '🔍'}
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-lg overflow-hidden">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectLocation(result)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}

            {form.latitude && form.longitude && (
              <p className="mt-1 text-xs text-gray-500">
                📍 {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
            </div>
          </div>

          {/* Trip Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trip Type
            </label>
            <select
              name="tripType"
              value={form.tripType}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
            >
              {TRIP_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Travelers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who went on this trip?
            </label>
            <div className="flex flex-wrap gap-2">
              {travelers.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTravelerToggle(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    form.travelerIds.includes(t.id)
                      ? 'bg-ocean-teal text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewTraveler(true)}
                className="px-3 py-1.5 rounded-full text-sm bg-sunset-orange/10 text-sunset-orange hover:bg-sunset-orange/20 transition-colors"
              >
                + Add
              </button>
            </div>

            {/* New Traveler Form */}
            {showNewTraveler && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg flex gap-2">
                <input
                  type="text"
                  value={newTraveler.name}
                  onChange={e => setNewTraveler(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
                <select
                  value={newTraveler.relationship}
                  onChange={e => setNewTraveler(prev => ({ ...prev, relationship: e.target.value }))}
                  className="px-3 py-2 border rounded text-sm"
                >
                  <option value="husband">Husband</option>
                  <option value="wife">Wife</option>
                  <option value="child">Child</option>
                  <option value="other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddTraveler}
                  className="px-3 py-2 bg-ocean-teal text-white rounded text-sm"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTraveler(false)}
                  className="px-3 py-2 border rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Memories
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="What made this trip special?"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-sunset-orange to-coral-pink text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving...' : (trip ? 'Update Trip' : 'Add Trip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
