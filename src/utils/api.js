import { inspectPhotoMetadata } from './photoMetadata';
import { preparePhotoVariants } from './photoProcessing';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const LEGACY_BEARER_AUTH = ['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_LEGACY_BEARER_AUTH || '').toLowerCase());
const USE_UPLOAD_SESSIONS = ['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_USE_UPLOAD_SESSIONS || '').toLowerCase());
const PLACE_CACHE_TTL_MS = 5 * 60 * 1000;
const placeSearchCache = new Map();
const inFlightPlaceSearches = new Map();

function normalizePlaceQuery(query) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function idempotencyHeaders(key) {
  return { 'idempotency-key': key || newIdempotencyKey() };
}

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
  }

  getToken() {
    return LEGACY_BEARER_AUTH ? localStorage.getItem('travel_token') : null;
  }

  setToken(token) {
    if (LEGACY_BEARER_AUTH && token) localStorage.setItem('travel_token', token);
    else localStorage.removeItem('travel_token');
  }

  clearToken() {
    localStorage.removeItem('travel_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    const { skipUnauthorizedRedirect = false, preserveUnauthorizedError = false, ...fetchOptions } = options;

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
      if (preserveUnauthorizedError) {
        const body = await response.json().catch(() => ({}));
        const error = new Error(body.error || 'Invalid email or password');
        error.isUnauthorized = true;
        throw error;
      }
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
      preserveUnauthorizedError: true,
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

  async verifyEmail(token) {
    return this.request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }), skipUnauthorizedRedirect: true });
  }

  async resendVerification() {
    return this.request('/auth/resend-verification', { method: 'POST' });
  }

  async getInvitation(token) {
    return this.request(`/auth/invitations/${encodeURIComponent(token)}`, { skipUnauthorizedRedirect: true });
  }

  async registerInvitation(token, displayName, password) {
    return this.request('/auth/register-invite', {
      method: 'POST',
      headers: idempotencyHeaders(),
      body: JSON.stringify({ token, displayName, password }),
      skipUnauthorizedRedirect: true,
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/account/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }), skipUnauthorizedRedirect: true });
  }

  async getSessions() {
    return this.request('/account/sessions');
  }

  async revokeOtherSessions() {
    return this.request('/account/sessions/revoke-others', { method: 'POST' });
  }

  async revokeAllSessions() {
    const result = await this.request('/account/sessions/revoke-all', { method: 'POST', skipUnauthorizedRedirect: true });
    this.clearToken();
    return result;
  }

  async getHouseholds() {
    return this.request('/households');
  }

  async createHousehold(name, idempotencyKey = null) {
    return this.request('/households', { method: 'POST', headers: idempotencyHeaders(idempotencyKey), body: JSON.stringify({ name }) });
  }

  async switchHousehold(householdId) {
    return this.request('/households/switch', { method: 'POST', body: JSON.stringify({ householdId }) });
  }

  async getHouseholdMembers() {
    return this.request('/households/current/members');
  }

  async requestHouseholdExport(idempotencyKey = null) {
    return this.request('/households/current/exports', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({}),
    });
  }

  async getHouseholdExports() {
    return this.request('/households/current/exports');
  }

  async getHouseholdExport(id) {
    return this.request(`/households/current/exports/${encodeURIComponent(id)}`);
  }

  async inviteHouseholdMember(email, idempotencyKey = null) {
    return this.request('/households/invitations', { method: 'POST', headers: idempotencyHeaders(idempotencyKey), body: JSON.stringify({ email }) });
  }

  async acceptInvitation(token, idempotencyKey = null) {
    return this.request('/households/invitations/accept', { method: 'POST', headers: idempotencyHeaders(idempotencyKey), body: JSON.stringify({ token }) });
  }

  // Trips
  async getTrips(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/trips${params ? `?${params}` : ''}`);
  }

  async getTripsPage({ limit = 50, cursor = null, ...filters } = {}) {
    const params = new URLSearchParams({ ...filters, paginate: 'true', limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.request(`/trips?${params.toString()}`);
  }

  async getAllTrips(filters = {}) {
    const trips = [];
    let cursor = null;
    for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
      const page = await this.getTripsPage({ ...filters, limit: 50, cursor });
      trips.push(...(Array.isArray(page?.items) ? page.items : []));
      if (!page?.next_cursor) return trips;
      if (page.next_cursor === cursor) throw new Error('The trip list returned a repeated page cursor. Please refresh and try again.');
      cursor = page.next_cursor;
    }
    throw new Error('The trip list is too large to load safely in one session.');
  }

  async getTrip(id) {
    return this.request(`/trips/${id}`);
  }

  async createTrip(trip, idempotencyKey = null) {
    return this.request('/trips', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(trip),
    });
  }

  async updateTrip(id, trip) {
    return this.request(`/trips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(trip),
    });
  }

  async deleteTrip(id, idempotencyKey = null) {
    return this.request(`/trips/${id}`, { method: 'DELETE', headers: idempotencyHeaders(idempotencyKey) });
  }

  async deleteTrips(ids, idempotencyKey = null) {
    return this.request('/trips/bulk-delete', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify({ ids }),
    });
  }

  // Journeys
  async getJourneys() {
    return this.request('/journeys');
  }

  async getJourneysPage({ limit = 20, cursor = null } = {}) {
    const params = new URLSearchParams({ paginate: 'true', limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.request(`/journeys?${params.toString()}`);
  }

  async getAllJourneys() {
    const journeys = [];
    let cursor = null;
    for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
      const page = await this.getJourneysPage({ limit: 20, cursor });
      journeys.push(...(Array.isArray(page?.items) ? page.items : []));
      if (!page?.next_cursor) return journeys;
      if (page.next_cursor === cursor) throw new Error('The journey list returned a repeated page cursor. Please refresh and try again.');
      cursor = page.next_cursor;
    }
    throw new Error('The journey list is too large to load safely in one session.');
  }

  async createJourney(journey, idempotencyKey = null) {
    return this.request('/journeys', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(journey),
    });
  }

  async updateJourney(id, journey) {
    return this.request(`/journeys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(journey),
    });
  }

  async deleteJourney(id, idempotencyKey = null) {
    return this.request(`/journeys/${id}`, { method: 'DELETE', headers: idempotencyHeaders(idempotencyKey) });
  }

  async createJourneyShare(id, idempotencyKey = null) {
    return this.request(`/journeys/${id}/share`, { method: 'POST', headers: idempotencyHeaders(idempotencyKey) });
  }

  async revokeJourneyShare(id, idempotencyKey = null) {
    return this.request(`/journeys/${id}/share`, { method: 'DELETE', headers: idempotencyHeaders(idempotencyKey) });
  }

  async getSharedJourney(token) {
    return this.request(`/shared/journeys/${encodeURIComponent(token)}`);
  }

  // Travelers
  async getTravelers({ includeInactive = false } = {}) {
    return this.request(`/travelers${includeInactive ? '?includeInactive=true' : ''}`);
  }

  async createTraveler(traveler, idempotencyKey = null) {
    return this.request('/travelers', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: JSON.stringify(traveler),
    });
  }

  async updateTraveler(id, traveler) {
    return this.request(`/travelers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(traveler),
    });
  }

  async deleteTraveler(id, idempotencyKey = null) {
    return this.request(`/travelers/${id}`, { method: 'DELETE', headers: idempotencyHeaders(idempotencyKey) });
  }

  // Photos
  async uploadPhotos(tripId, files, existingMetadata = null) {
    const allFiles = Array.from(files);
    const maxPhotosPerAction = Math.max(1, Number(import.meta.env.VITE_MAX_UPLOADS_PER_ACTION || 50));
    if (allFiles.length > maxPhotosPerAction) {
      throw new Error(`Choose no more than ${maxPhotosPerAction} photos at a time.`);
    }
    const metadata = existingMetadata || (await inspectPhotoMetadata(allFiles)).photos;
    const uploaded = [];
    const batchSize = 5;

    for (let start = 0; start < allFiles.length; start += batchSize) {
      const batchFiles = allFiles.slice(start, start + batchSize);
      const batchMetadata = metadata.slice(start, start + batchFiles.length);
      uploaded.push(...await this.uploadPhotoBatch(tripId, batchFiles, batchMetadata));
    }

    return { count: uploaded.length, photos: uploaded };
  }

  async uploadPhotoBatch(tripId, files, metadata) {
    if (USE_UPLOAD_SESSIONS) return this.uploadPhotoBatchWithSessions(tripId, files, metadata);
    const formData = new FormData();
    const uploadIds = files.map(() => crypto.randomUUID());
    const uploadAttemptId = crypto.randomUUID();
    // The legacy Docker API accepts the original files under `photos` and
    // creates its own processed copies. Variant fields belong to the upload
    // session path above; sending them here makes Multer reject the request.
    files.forEach(file => {
      formData.append('photos', file);
    });
    formData.append('photoUploadIds', JSON.stringify(uploadIds));
    formData.append('uploadAttemptId', uploadAttemptId);
    formData.append('photoMetadata', JSON.stringify(metadata));

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await this.request(`/photos/${tripId}`, { method: 'POST', body: formData });
        return result.photos || [];
      } catch (error) {
        lastError = error;
        if (attempt === 0 && (error.isNetworkError || error.message === 'Request failed')) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async uploadPhotoBatchWithSessions(tripId, files, metadata) {
    const variants = await preparePhotoVariants(files);
    const uploadIds = files.map(() => crypto.randomUUID());
    const descriptors = files.map((file, index) => ({
      clientUploadId: uploadIds[index],
      filename: file.name || 'photo',
      mimeType: file.type || 'application/octet-stream',
      bytes: file.size,
      ...(variants[index]?.display ? { display: { bytes: variants[index].display.blob.size } } : {}),
      ...(variants[index]?.thumbnail ? { thumbnail: { bytes: variants[index].thumbnail.blob.size } } : {}),
    }));
    const createKey = newIdempotencyKey();
    let sessionResult;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        sessionResult = await this.request('/photos/upload-sessions', {
          method: 'POST',
          headers: idempotencyHeaders(createKey),
          body: JSON.stringify({ tripId, files: descriptors }),
        });
        break;
      } catch (error) {
        if (attempt === 0 && error.isNetworkError) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw error;
      }
    }
    const endpoint = value => value.startsWith(API_URL) ? value.slice(API_URL.length) : value;
    const uploaded = [];
    for (let index = 0; index < files.length; index += 1) {
      const session = sessionResult.sessions[index];
      if (session.status === 'complete') {
        if (session.photo) uploaded.push(session.photo);
        continue;
      }
      const variantFiles = [
        ['original', files[index]],
        ['display', variants[index]?.display?.blob],
        ['thumbnail', variants[index]?.thumbnail?.blob],
      ];
      for (const [variant, blob] of variantFiles) {
        if (!blob || !session[variant]) continue;
        let lastError;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await this.request(endpoint(session[variant].upload_url), {
              method: 'PUT',
              headers: { 'content-type': variant === 'original' ? (files[index].type || 'application/octet-stream') : 'image/jpeg' },
              body: blob,
            });
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt === 0 && error.isNetworkError) {
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
            throw error;
          }
        }
        if (lastError) throw lastError;
      }
      const finalized = await this.request(endpoint(session.finalize_url), {
        method: 'POST',
        headers: idempotencyHeaders(newIdempotencyKey()),
        body: JSON.stringify({ metadata: metadata[index] || {} }),
      });
      uploaded.push(finalized);
    }
    return uploaded;
  }

  async getPhotoMetadataSuggestions(files) {
    return inspectPhotoMetadata(files);
  }

  async getPhotos(tripId) {
    return this.request(`/photos/${tripId}`);
  }

  async getPhotosPage(tripId, { limit = 100, cursor = null } = {}) {
    const params = new URLSearchParams({ paginate: 'true', limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return this.request(`/photos/${tripId}?${params.toString()}`);
  }

  async getAllPhotos(tripId) {
    const photos = [];
    let cursor = null;
    for (let pageNumber = 0; pageNumber < 1000; pageNumber += 1) {
      const page = await this.getPhotosPage(tripId, { limit: 100, cursor });
      photos.push(...(Array.isArray(page?.photos) ? page.photos : []));
      if (!page?.next_cursor) return photos;
      if (page.next_cursor === cursor) throw new Error('The photo list returned a repeated page cursor. Please refresh and try again.');
      cursor = page.next_cursor;
    }
    throw new Error('This photo collection is too large to load safely in one session.');
  }

  async getPhotoQuota() {
    return this.request('/photos/quota');
  }

  async deletePhoto(id, idempotencyKey = null) {
    return this.request(`/photos/${id}`, { method: 'DELETE', headers: idempotencyHeaders(idempotencyKey) });
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

  async backfillPhotoLocations(idempotencyKey = null) {
    const headers = idempotencyKey ? { 'idempotency-key': idempotencyKey } : {};
    return this.request('/photos/location-backfill', { method: 'POST', headers });
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

  async reverseGeocode(latitude, longitude) {
    return this.request(`/places/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
  }

  // Analytics
  async getAnalytics() {
    return this.request('/analytics');
  }
}

export default new ApiClient();
