import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import api, { newIdempotencyKey } from '../utils/api';
import { useAuth } from './AuthContext';
import { sortTravelers } from '../utils/travelers';
import {
  enqueueMutation,
  enqueueUpload,
  getMutations,
  getUploads,
  getSnapshot,
  removeMutation,
  removeUpload,
  saveSnapshot,
} from '../utils/offlineStore';

const DataContext = createContext(null);

function tempId(prefix) {
  return `offline-${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function isOfflineError(error) {
  return Boolean(error?.isNetworkError) || !navigator.onLine;
}

function localTrip(data) {
  return {
    id: tempId('trip'), location_name: data.locationName, city: data.city || null,
    latitude: data.latitude, longitude: data.longitude, country: data.country || null,
    state: data.state || null, start_date: data.startDate || null, end_date: data.endDate || null,
    date_label: data.dateLabel || null, date_precision: data.datePrecision || 'exact',
    trip_type: data.tripType || 'Other', notes: data.notes || null, travelers: [], photos: [],
    _offline: true,
  };
}

function localTraveler(data) {
  return { id: tempId('traveler'), name: data.name, relationship: data.relationship || 'other', is_active: true, _offline: true };
}

function localJourney(data) {
  return {
    id: tempId('journey'), title: data.title, start_date: data.startDate || null,
    end_date: data.endDate || null, date_label: data.dateLabel || null,
    journey_type: data.journeyType || 'Other', summary: data.summary || null,
    cover_photo_id: data.coverPhotoId || null, memories: [], _offline: true,
  };
}

function replaceIds(value, replacements) {
  if (Array.isArray(value)) return value.map(item => replaceIds(item, replacements));
  if (!value || typeof value !== 'object') {
    return replacements.has(String(value)) ? replacements.get(String(value)) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIds(item, replacements)]));
}

function mutationRequestPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const { _idempotencyKey, ...requestPayload } = payload;
  return requestPayload;
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const hydrated = useRef(false);
  const syncInFlight = useRef(false);
  const tempIdMap = useRef(new Map());

  const refreshPendingCount = useCallback(async () => {
    if (!user) return;
    setPendingCount((await getMutations(user.id)).length + (await getUploads(user.id)).length);
  }, [user]);

  const loadTrips = useCallback(async (filters = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getAllTrips(filters);
      setTrips(data);
      setOffline(false);
    } catch (err) {
      if (isOfflineError(err)) setOffline(true); else console.error('Failed to load trips:', err);
    } finally { setLoading(false); }
  }, [user]);

  const loadTravelers = useCallback(async ({ includeInactive = false } = {}) => {
    if (!user) return;
    try {
      setTravelers(sortTravelers(await api.getTravelers({ includeInactive })));
      setOffline(false);
    } catch (err) {
      if (isOfflineError(err)) setOffline(true); else console.error('Failed to load travelers:', err);
    }
  }, [user]);

  const loadJourneys = useCallback(async () => {
    if (!user) return;
    try { setJourneys(await api.getAllJourneys()); setOffline(false); }
    catch (err) { if (isOfflineError(err)) setOffline(true); else console.error('Failed to load journeys:', err); }
  }, [user]);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    try { setAnalytics(await api.getAnalytics()); setOffline(false); }
    catch (err) { if (isOfflineError(err)) setOffline(true); else console.error('Failed to load analytics:', err); }
  }, [user]);

  const refreshAll = useCallback(async () => {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      if (navigator.onLine) await syncMutations();
      await Promise.all([
        loadTrips(),
        loadTravelers({ includeInactive: true }),
        loadJourneys(),
        loadAnalytics(),
      ]);
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }, [user, refreshing, loadTrips, loadTravelers, loadJourneys, loadAnalytics]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!user) {
        hydrated.current = false;
        setTrips([]); setTravelers([]); setJourneys([]); setAnalytics(null);
        setPendingCount(0); setLastSyncedAt(null); return;
      }
      hydrated.current = false;
      const snapshot = await getSnapshot(user.id);
      if (cancelled) return;
      if (snapshot) {
        setTrips(snapshot.trips || []); setTravelers(snapshot.travelers || []);
        setJourneys(snapshot.journeys || []); setAnalytics(snapshot.analytics || null);
        setLastSyncedAt(snapshot.lastSyncedAt || null);
      }
      hydrated.current = true;
      await refreshPendingCount();
      await Promise.all([loadTrips(), loadTravelers({ includeInactive: true }), loadJourneys(), loadAnalytics()]);
      if (!navigator.onLine) setOffline(true);
      else await syncMutations();
    }
    bootstrap();
    return () => { cancelled = true; };
  }, [user, loadTrips, loadTravelers, loadJourneys, loadAnalytics, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => { setOffline(false); syncMutations(); };
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  });

  useEffect(() => {
    if (!user || !hydrated.current) return;
    saveSnapshot(user.id, { trips, travelers, journeys, analytics, lastSyncedAt });
  }, [user, trips, travelers, journeys, analytics, lastSyncedAt]);

  async function queue(entity, entityId, operation, payload) {
    await enqueueMutation({ userId: String(user.id), entity, entityId: String(entityId), operation, payload });
    await refreshPendingCount();
    setOffline(true);
  }

  async function queuePhotoUpload(tripId, files) {
    if (!user || !files?.length) return;
    await enqueueUpload({ userId: String(user.id), tripId: String(tripId), files: Array.from(files) });
    await refreshPendingCount();
    setOffline(true);
  }

  async function syncMutations() {
    if (!user || syncInFlight.current || !navigator.onLine) return;
    syncInFlight.current = true; setSyncing(true); setSyncError('');
    try {
      const mutations = (await getMutations(user.id)).sort((a, b) => a.createdAt - b.createdAt);
      for (const mutation of mutations) {
        const payload = replaceIds(mutation.payload, tempIdMap.current);
        const idempotencyKey = payload?._idempotencyKey || newIdempotencyKey();
        const requestPayload = mutationRequestPayload(payload);
        try {
          let result;
          if (mutation.operation === 'create') {
            result = mutation.entity === 'trip' ? await api.createTrip(requestPayload, idempotencyKey)
              : mutation.entity === 'traveler' ? await api.createTraveler(requestPayload, idempotencyKey)
                : await api.createJourney(requestPayload, idempotencyKey);
            if (String(mutation.entityId).startsWith('offline-') && result?.id) tempIdMap.current.set(String(mutation.entityId), result.id);
          } else if (mutation.operation === 'update') {
            result = mutation.entity === 'trip' ? await api.updateTrip(payload.id, payload.data)
              : mutation.entity === 'traveler' ? await api.updateTraveler(payload.id, payload.data)
                : await api.updateJourney(payload.id, payload.data);
          } else if (mutation.operation === 'delete') {
            const resolvedId = tempIdMap.current.get(String(payload.id)) || payload.id;
            if (!String(resolvedId).startsWith('offline-')) {
              result = mutation.entity === 'trip' ? await api.deleteTrip(resolvedId, idempotencyKey)
                : mutation.entity === 'journey' ? await api.deleteJourney(resolvedId, idempotencyKey) : await api.deleteTraveler(resolvedId, idempotencyKey);
            }
            if (mutation.entity === 'trip') {
              const queuedUploads = await getUploads(user.id);
              await Promise.all(queuedUploads
                .filter(upload => String(upload.tripId) === String(mutation.entityId))
                .map(upload => removeUpload(upload.id)));
            }
          }
          await removeMutation(mutation.id);
          if (result?.id && mutation.entity === 'trip') {
            setTrips(current => current.map(item => String(item.id) === String(mutation.entityId) ? result : item));
          }
        } catch (error) {
          if (isOfflineError(error)) { setOffline(true); break; }
          setSyncError(error.message || 'A saved change needs your attention.');
          break;
        }
      }
      const uploads = (await getUploads(user.id)).sort((a, b) => a.createdAt - b.createdAt);
      for (const upload of uploads) {
        try {
          const tripId = tempIdMap.current.get(String(upload.tripId)) || upload.tripId;
          await api.uploadPhotos(tripId, upload.files);
          await removeUpload(upload.id);
        } catch (error) {
          if (isOfflineError(error)) { setOffline(true); break; }
          setSyncError(error.message || 'A saved photo upload needs your attention.');
          break;
        }
      }
      await refreshPendingCount();
      if (navigator.onLine) {
        await Promise.all([loadTrips(), loadTravelers({ includeInactive: true }), loadJourneys(), loadAnalytics()]);
        setLastSyncedAt(new Date().toISOString());
      }
    } finally { syncInFlight.current = false; setSyncing(false); }
  }

  async function addTrip(data, idempotencyKey = newIdempotencyKey()) {
    if (offline || !navigator.onLine) {
      const trip = localTrip(data); setTrips(prev => [trip, ...prev]); await queue('trip', trip.id, 'create', { ...data, _idempotencyKey: idempotencyKey }); return trip;
    }
    try { const trip = await api.createTrip(data, idempotencyKey); setTrips(prev => [trip, ...prev]); await loadAnalytics(); return trip; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return addTrip(data, idempotencyKey); }
  }

  async function updateTrip(id, data) {
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) {
      const existing = trips.find(item => String(item.id) === String(id));
      const next = { ...existing, ...localTrip(data), id, travelers: existing?.travelers || [], photos: existing?.photos || [], _offline: true };
      setTrips(prev => prev.map(item => String(item.id) === String(id) ? next : item));
      await queue('trip', id, 'update', { id, data }); return next;
    }
    try { const trip = await api.updateTrip(id, data); setTrips(prev => prev.map(t => t.id === id ? trip : t)); await Promise.all([loadAnalytics(), loadJourneys()]); return trip; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return updateTrip(id, data); }
  }

  async function deleteTrip(id, idempotencyKey = newIdempotencyKey()) {
    const removeFromView = () => setTrips(prev => prev.filter(t => String(t.id) !== String(id)));
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) {
      removeFromView();
      await queue('trip', id, 'delete', { id, _idempotencyKey: idempotencyKey });
      return;
    }
    try {
      await api.deleteTrip(id, idempotencyKey);
      removeFromView();
      await Promise.all([loadAnalytics(), loadJourneys()]);
    } catch (error) {
      if (!isOfflineError(error)) throw error;
      setOffline(true);
      removeFromView();
      await queue('trip', id, 'delete', { id, _idempotencyKey: idempotencyKey });
    }
  }

  async function deleteTrips(ids) {
    for (const id of ids) await deleteTrip(id);
    return { deletedIds: ids, count: ids.length };
  }

  async function addTraveler(data, idempotencyKey = newIdempotencyKey()) {
    if (offline || !navigator.onLine) { const traveler = localTraveler(data); setTravelers(prev => sortTravelers([...prev, traveler])); await queue('traveler', traveler.id, 'create', { ...data, _idempotencyKey: idempotencyKey }); return traveler; }
    try { const traveler = await api.createTraveler(data, idempotencyKey); setTravelers(prev => sortTravelers([...prev, traveler])); return traveler; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return addTraveler(data, idempotencyKey); }
  }

  async function updateTraveler(id, data) {
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) {
      setTravelers(prev => sortTravelers(prev.map(item => String(item.id) === String(id) ? { ...item, ...data, is_active: data.isActive ?? item.is_active, _offline: true } : item)));
      await queue('traveler', id, 'update', { id, data }); return data;
    }
    try { const traveler = await api.updateTraveler(id, data); setTravelers(prev => sortTravelers(prev.map(t => t.id === id ? traveler : t))); return traveler; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return updateTraveler(id, data); }
  }

  async function deleteTraveler(id, idempotencyKey = newIdempotencyKey()) {
    setTravelers(prev => prev.filter(t => String(t.id) !== String(id)));
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) return queue('traveler', id, 'delete', { id, _idempotencyKey: idempotencyKey });
    try { await api.deleteTraveler(id, idempotencyKey); } catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); await queue('traveler', id, 'delete', { id, _idempotencyKey: idempotencyKey }); }
  }

  async function addJourney(data, idempotencyKey = newIdempotencyKey()) {
    if (offline || !navigator.onLine) { const journey = localJourney(data); setJourneys(prev => [journey, ...prev]); await queue('journey', journey.id, 'create', { ...data, _idempotencyKey: idempotencyKey }); return journey; }
    try { const journey = await api.createJourney(data, idempotencyKey); setJourneys(prev => [journey, ...prev]); await loadTrips(); return journey; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return addJourney(data, idempotencyKey); }
  }

  async function updateJourney(id, data) {
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) { setJourneys(prev => prev.map(item => String(item.id) === String(id) ? { ...item, ...data, _offline: true } : item)); await queue('journey', id, 'update', { id, data }); return data; }
    try { const journey = await api.updateJourney(id, data); setJourneys(prev => prev.map(item => item.id === id ? journey : item)); await loadTrips(); return journey; }
    catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); return updateJourney(id, data); }
  }

  async function deleteJourney(id, idempotencyKey = newIdempotencyKey()) {
    setJourneys(prev => prev.filter(item => String(item.id) !== String(id)));
    if (String(id).startsWith('offline-') || offline || !navigator.onLine) return queue('journey', id, 'delete', { id, _idempotencyKey: idempotencyKey });
    try { await api.deleteJourney(id, idempotencyKey); await loadTrips(); } catch (error) { if (!isOfflineError(error)) throw error; setOffline(true); await queue('journey', id, 'delete', { id, _idempotencyKey: idempotencyKey }); }
  }

  return (
    <DataContext.Provider value={{
      trips, travelers, journeys, analytics, loading,
      offline, syncing, refreshing, pendingCount, syncError, lastSyncedAt, syncMutations, refreshAll,
      loadTrips, loadTravelers, loadJourneys, loadAnalytics,
      addTrip, updateTrip, deleteTrip, deleteTrips,
      queuePhotoUpload,
      addJourney, updateJourney, deleteJourney,
      addTraveler, updateTraveler, deleteTraveler,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
