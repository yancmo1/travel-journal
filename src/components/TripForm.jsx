import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { nominatimSearch, placeAutocomplete } from '../utils/geocoding';
import api from '../utils/api';

const TRIP_TYPES = ['Road Trip', 'Flight', 'Cruise', 'Day Trip', 'Other'];
const RELATIONSHIPS = [
  ['husband', 'Husband'],
  ['wife', 'Wife'],
  ['child', 'Child'],
  ['grandchild', 'Grandkid'],
  ['other', 'Other'],
];

export default function TripForm({ trip, onClose }) {
  const { travelers, addTrip, updateTrip, addTraveler, loadTrips } = useData();
  
  const [form, setForm] = useState({
    locationName: '',
    city: '',
    latitude: null,
    longitude: null,
    country: '',
    state: '',
    startDate: '',
    endDate: '',
    dateLabel: '',
    datePrecision: 'exact',
    tripType: 'Other',
    notes: '',
    travelerIds: [],
  });
  
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewTraveler, setShowNewTraveler] = useState(false);
  const [newTraveler, setNewTraveler] = useState({ name: '', relationship: 'child' });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [savedTripId, setSavedTripId] = useState(null);
  const skipNextAutocomplete = useRef(false);

  useEffect(() => {
    if (trip) {
      setForm({
        locationName: trip.location_name || '',
        city: trip.city || '',
        latitude: trip.latitude == null ? null : Number(trip.latitude),
        longitude: trip.longitude == null ? null : Number(trip.longitude),
        country: trip.country || '',
        state: trip.state || '',
        startDate: trip.start_date ? trip.start_date.split('T')[0] : '',
        endDate: trip.end_date ? trip.end_date.split('T')[0] : '',
        dateLabel: trip.date_label || '',
        datePrecision: trip.date_precision || (trip.start_date ? 'exact' : 'unknown'),
        tripType: trip.trip_type || 'Other',
        notes: trip.notes || '',
        travelerIds: trip.travelers?.map(t => t.id) || [],
      });
    }
  }, [trip]);

  useEffect(() => {
    if (skipNextAutocomplete.current) {
      skipNextAutocomplete.current = false;
      return;
    }

    if (!activeSearchField) {
      setSearchResults([]);
      return;
    }

    const queryParts = activeSearchField === 'city'
      ? [form.city, form.state, form.country]
      : activeSearchField === 'state'
        ? [form.state, form.country]
        : [form.locationName];
    const query = queryParts.filter(part => part?.trim()).join(', ').trim();

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await placeAutocomplete(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [activeSearchField, form.locationName, form.city, form.state, form.country]);

  function handleChange(e) {
    const { name, value } = e.target;
    const isSearchField = ['locationName', 'city', 'state'].includes(name);

    if (isSearchField) {
      setActiveSearchField(name);
    }

    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(isSearchField ? { latitude: null, longitude: null } : {}),
    }));
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

    setActiveSearchField('locationName');
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

  function getLocationDetails(result) {
    const parts = result.display_name.split(', ');
    const address = result.address || {};
    const country = address.country || parts[parts.length - 1] || '';
    const state = address.state || address.region || '';
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      parts[0] ||
      '';
    const placeName =
      address.tourism ||
      address.attraction ||
      address.amenity ||
      address.building ||
      parts[0] ||
      city;

    return { city, state, country, placeName };
  }

  function selectLocation(result, field = activeSearchField) {
    const { city, state, country, placeName } = getLocationDetails(result);

    skipNextAutocomplete.current = true;
    setForm(prev => {
      if (field === 'state') {
        return {
          ...prev,
          state,
          country,
          latitude: result.lat,
          longitude: result.lng,
        };
      }

      if (field === 'city') {
        return {
          ...prev,
          locationName: prev.locationName || city,
          city,
          state,
          country,
          latitude: result.lat,
          longitude: result.lng,
        };
      }

      return {
        ...prev,
        locationName: placeName,
        city,
        latitude: result.lat,
        longitude: result.lng,
        country,
        state,
      };
    });
    setSearchResults([]);
    setActiveSearchField(null);
  }

  function renderSearchResults(field, label) {
    if (activeSearchField !== field || searchResults.length === 0) return null;

    return (
      <div className="mt-2 border rounded-lg overflow-hidden shadow-lg bg-white relative z-10" role="listbox" aria-label={label}>
        {searchResults.map((result, i) => (
          <button
            key={`${result.lat}-${result.lng}-${i}`}
            type="button"
            role="option"
            onClick={() => selectLocation(result, field)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0"
          >
            {result.display_name}
          </button>
        ))}
      </div>
    );
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
    if (form.datePrecision === 'exact' && !form.startDate) {
      setError('Choose a date, or change date knowledge to year-only or unknown');
      return;
    }
    if (form.datePrecision === 'year' && !form.dateLabel.trim()) {
      setError('Enter the year or approximate date');
      return;
    }

    setSaving(true);
    let memorySaved = false;

    try {
      let latitude = form.latitude;
      let longitude = form.longitude;

      // Saving a city should be enough to place the memory on the map.
      if (!latitude || !longitude) {
        const mapQuery = [form.locationName, form.city, form.state, form.country]
          .filter(Boolean)
          .join(', ');

        try {
          const mapResults = await nominatimSearch(mapQuery);
          if (mapResults[0]) {
            latitude = mapResults[0].lat;
            longitude = mapResults[0].lng;
          }
        } catch {
          // The memory can still be saved and mapped later.
        }
      }

      const data = {
        locationName: form.locationName,
        city: form.city,
        latitude,
        longitude,
        country: form.country,
        state: form.state,
        startDate: form.datePrecision === 'exact' ? form.startDate : null,
        endDate: form.datePrecision === 'exact' ? form.endDate || null : null,
        dateLabel: form.datePrecision === 'exact' ? null : form.dateLabel,
        datePrecision: form.datePrecision,
        tripType: form.tripType,
        notes: form.notes,
        travelerIds: form.travelerIds,
      };

      let savedTrip;
      const existingTripId = trip?.id || savedTripId;

      if (existingTripId) {
        savedTrip = await updateTrip(existingTripId, data);
      } else {
        savedTrip = await addTrip(data);
        setSavedTripId(savedTrip.id);
      }
      memorySaved = true;

      if (photoFiles.length > 0) {
        const uploadResult = await api.uploadPhotos(savedTrip.id, photoFiles);
        if (!uploadResult.count) {
          throw new Error('The memory was saved, but none of the selected photos could be processed.');
        }
        await loadTrips();
      }
      
      onClose();
    } catch (err) {
      const prefix = memorySaved || savedTripId ? 'The memory was saved. ' : '';
      setError(`${prefix}${err.message || 'Failed to save memory'}`);
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
              {trip ? 'Edit Memory' : 'Add a Memory'}
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
              Find a city or place *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="locationName"
                value={form.locationName}
                onChange={handleChange}
                placeholder="Start typing St. Louis or Gateway Arch"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={activeSearchField === 'locationName' && searchResults.length > 0}
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
            {renderSearchResults('locationName', 'Location suggestions')}
            <p className="mt-1 text-[10px] text-gray-400">City suggestions use Open-Meteo and GeoNames. Use 🔍 for a landmark.</p>

            {Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) && (
              <p className="mt-1 text-xs text-gray-500">
                📍 {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="St. Louis"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={activeSearchField === 'city' && searchResults.length > 0}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
              {renderSearchResults('city', 'City suggestions')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / region</label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="Missouri"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={activeSearchField === 'state' && searchResults.length > 0}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
              {renderSearchResults('state', 'State or region suggestions')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={handleChange}
                placeholder="United States"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What do you know about the date?</label>
            <select
              name="datePrecision"
              value={form.datePrecision}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
            >
              <option value="exact">I know the date</option>
              <option value="year">I know the year or an approximate date</option>
              <option value="unknown">I don’t know yet</option>
            </select>
          </div>

          {form.datePrecision === 'exact' && (
            <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
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
          )}

          {form.datePrecision !== 'exact' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.datePrecision === 'year' ? 'Year or approximate date *' : 'Date note (optional)'}
              </label>
              <input
                type="text"
                name="dateLabel"
                value={form.dateLabel}
                onChange={handleChange}
                placeholder={form.datePrecision === 'year' ? '2004 or around 1999' : 'We’ll fill this in later'}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ocean-teal"
              />
            </div>
          )}

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
                  {RELATIONSHIPS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
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

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photos
            </label>
            <input
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              onChange={event => setPhotoFiles(Array.from(event.target.files || []))}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ocean-blue/10 file:px-4 file:py-2 file:font-medium file:text-ocean-blue hover:file:bg-ocean-blue/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              {photoFiles.length > 0
                ? `${photoFiles.length} photo${photoFiles.length === 1 ? '' : 's'} will upload when you save this memory.`
                : 'You can select several photos now or add more later.'}
            </p>
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
              {saving ? 'Saving...' : (trip ? 'Save Changes' : 'Save Memory')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
