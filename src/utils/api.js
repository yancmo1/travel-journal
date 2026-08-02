import { inspectPhotoMetadata } from './photoMetadata';

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
    const { skipUnauthorizedRedirect = false, ...fetchOptions } = options;

    const config = {
      ...fetchOptions,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    // Don't set Content-Type for FormData
    if (fetchOptions.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      const networkError = new Error('You appear to be offline. Your changes will be saved on this device and synced when you reconnect.');
      networkError.isNetworkError = true;
      networkError.cause = error;
      throw networkError;
    }

    if (response.status === 401) {
      this.clearToken();
      const error = new Error('Your session has expired. Please sign in again.');
      error.isUnauthorized = true;
      if (!skipUnauthorizedRedirect) window.location.href = '/?login=1';
      throw error;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipUnauthorizedRedirect: true,
    });
    if (data.token) this.setToken(data.token); else this.clearToken();
    return data;
  }

  async register(email, password, displayName) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request('/auth/me', { skipUnauthorizedRedirect: true });
  }

  logout() {
    this.clearToken();
    return this.request('/auth/logout', { method: 'POST', skipUnauthorizedRedirect: true }).catch(() => null);
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }), skipUnauthorizedRedirect: true });
  }

  async resetPassword(token, password) {
    return this.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }), skipUnauthorizedRedirect: true });
  }

  async getInvitation(token) {
    return this.request(`/auth/invitations/${encodeURIComponent(token)}`, { skipUnauthorizedRedirect: true });
  }

  async registerInvitation(token, displayName, password) {
    return this.request('/auth/register-invite', { method: 'POST', body: JSON.stringify({ token, displayName, password }), skipUnauthorizedRedirect: true });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }), skipUnauthorizedRedirect: true });
  }

  async getHouseholds() {
    return this.request('/households');
  }

  async createHousehold(name) {
    return this.request('/households', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async switchHousehold(householdId) {
    return this.request('/households/switch', { method: 'POST', body: JSON.stringify({ householdId }) });
  }

  async getHouseholdMembers() {
    return this.request('/households/current/members');
  }

  async inviteHouseholdMember(email) {
    return this.request('/households/invitations', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async acceptInvitation(token) {
    return this.request('/households/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
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
  async uploadPhotos(tripId, files, existingMetadata = null) {
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));
    const metadata = existingMetadata || (await inspectPhotoMetadata(files)).photos;
    formData.append('photoMetadata', JSON.stringify(metadata));
    
    return this.request(`/photos/${tripId}`, {
      method: 'POST',
      body: formData,
    });
  }

  async getPhotoMetadataSuggestions(files) {
    return inspectPhotoMetadata(files);
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

  async runBackup() {
    return this.request('/maintenance/backup-now', { method: 'POST' });
  }

  async getOperations() {
    return this.request('/admin/operations');
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
