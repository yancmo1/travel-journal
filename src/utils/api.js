const API_URL = import.meta.env.VITE_API_URL || '/api';
const PLACE_CACHE_TTL_MS = 5 * 60 * 1000;
const placeSearchCache = new Map();
const inFlightPlaceSearches = new Map();

function normalizePlaceQuery(query) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return localStorage.getItem('travel_token');
  }

  setToken(token) {
    localStorage.setItem('travel_token', token);
  }

  clearToken() {
    localStorage.removeItem('travel_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    // Don't set Content-Type for FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    const response = await fetch(url, config);

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(username, password, displayName) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.clearToken();
  }

  // Trips
  async getTrips(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/trips${params ? `?${params}` : ''}`);
  }

  async getTrip(id) {
    return this.request(`/trips/${id}`);
  }

  async createTrip(trip) {
    return this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(trip),
    });
  }

  async updateTrip(id, trip) {
    return this.request(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(trip),
    });
  }

  async deleteTrip(id) {
    return this.request(`/trips/${id}`, { method: 'DELETE' });
  }

  async deleteTrips(ids) {
    return this.request('/trips/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  // Journeys
  async getJourneys() {
    return this.request('/journeys');
  }

  async createJourney(journey) {
    return this.request('/journeys', {
      method: 'POST',
      body: JSON.stringify(journey),
    });
  }

  async updateJourney(id, journey) {
    return this.request(`/journeys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(journey),
    });
  }

  async deleteJourney(id) {
    return this.request(`/journeys/${id}`, { method: 'DELETE' });
  }

  async createJourneyShare(id) {
    return this.request(`/journeys/${id}/share`, { method: 'POST' });
  }

  async revokeJourneyShare(id) {
    return this.request(`/journeys/${id}/share`, { method: 'DELETE' });
  }

  async getSharedJourney(token) {
    return this.request(`/shared/journeys/${encodeURIComponent(token)}`);
  }

  // Travelers
  async getTravelers({ includeInactive = false } = {}) {
    return this.request(`/travelers${includeInactive ? '?includeInactive=true' : ''}`);
  }

  async createTraveler(traveler) {
    return this.request('/travelers', {
      method: 'POST',
      body: JSON.stringify(traveler),
    });
  }

  async updateTraveler(id, traveler) {
    return this.request(`/travelers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(traveler),
    });
  }

  async deleteTraveler(id) {
    return this.request(`/travelers/${id}`, { method: 'DELETE' });
  }

  // Photos
  async uploadPhotos(tripId, files) {
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));
    
    return this.request(`/photos/${tripId}`, {
      method: 'POST',
      body: formData,
    });
  }

  async getPhotoMetadataSuggestions(files) {
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));

    return this.request('/photos/metadata-suggestions', {
      method: 'POST',
      body: formData,
    });
  }

  async getPhotos(tripId) {
    return this.request(`/photos/${tripId}`);
  }

  async deletePhoto(id) {
    return this.request(`/photos/${id}`, { method: 'DELETE' });
  }

  async updatePhoto(id, changes) {
    return this.request(`/photos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
  }

  async reorderPhotos(tripId, photoIds) {
    return this.request(`/photos/${tripId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ photoIds }),
    });
  }

  async getLocationBackfillCandidates() {
    return this.request('/photos/location-backfill');
  }

  async backfillPhotoLocations() {
    return this.request('/photos/location-backfill', { method: 'POST' });
  }

  async getBackupStatus() {
    return this.request('/maintenance/backup-status');
  }

  // Places
  async searchPlaces(query) {
    const cacheKey = normalizePlaceQuery(query);
    if (!cacheKey) return [];

    const cached = placeSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results;
    }
    if (cached) placeSearchCache.delete(cacheKey);

    if (inFlightPlaceSearches.has(cacheKey)) {
      return inFlightPlaceSearches.get(cacheKey);
    }

    const request = this.request(`/places/search?q=${encodeURIComponent(cacheKey)}`)
      .then(results => {
        placeSearchCache.set(cacheKey, {
          results,
          expiresAt: Date.now() + PLACE_CACHE_TTL_MS,
        });
        return results;
      })
      .finally(() => {
        inFlightPlaceSearches.delete(cacheKey);
      });

    inFlightPlaceSearches.set(cacheKey, request);
    return request;
  }

  // Analytics
  async getAnalytics() {
    return this.request('/analytics');
  }
}

export default new ApiClient();
