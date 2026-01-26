import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTrips = useCallback(async (filters = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getTrips(filters);
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadTravelers = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getTravelers();
      setTravelers(data);
    } catch (err) {
      console.error('Failed to load travelers:', err);
    }
  }, [user]);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTrips();
      loadTravelers();
      loadAnalytics();
    } else {
      setTrips([]);
      setTravelers([]);
      setAnalytics(null);
    }
  }, [user, loadTrips, loadTravelers, loadAnalytics]);

  async function addTrip(tripData) {
    const trip = await api.createTrip(tripData);
    setTrips(prev => [trip, ...prev]);
    loadAnalytics();
    return trip;
  }

  async function updateTrip(id, tripData) {
    const trip = await api.updateTrip(id, tripData);
    setTrips(prev => prev.map(t => t.id === id ? trip : t));
    loadAnalytics();
    return trip;
  }

  async function deleteTrip(id) {
    await api.deleteTrip(id);
    setTrips(prev => prev.filter(t => t.id !== id));
    loadAnalytics();
  }

  async function addTraveler(data) {
    const traveler = await api.createTraveler(data);
    setTravelers(prev => [...prev, traveler]);
    return traveler;
  }

  async function updateTraveler(id, data) {
    const traveler = await api.updateTraveler(id, data);
    setTravelers(prev => prev.map(t => t.id === id ? traveler : t));
    return traveler;
  }

  async function deleteTraveler(id) {
    await api.deleteTraveler(id);
    setTravelers(prev => prev.filter(t => t.id !== id));
  }

  return (
    <DataContext.Provider value={{
      trips, travelers, analytics, loading,
      loadTrips, loadTravelers, loadAnalytics,
      addTrip, updateTrip, deleteTrip,
      addTraveler, updateTraveler, deleteTraveler
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
