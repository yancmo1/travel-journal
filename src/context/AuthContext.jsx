import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { clearOfflineData, getSnapshot, requestPersistentStorage, saveSnapshot } from '../utils/offlineStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function checkAuth() {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setHouseholds(data.households || []);
      setActiveHouseholdId(data.active_household_id || null);
      setOffline(false);
      await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
      requestPersistentStorage();
    } catch (error) {
      if (error.isNetworkError) {
        let cached = await getSnapshot('last-user');
        try {
          const [, payload] = api.getToken().split('.');
          const tokenUser = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
          cached = await getSnapshot(String(tokenUser.id)) || cached;
        } catch { /* Use the last verified browser session as a fallback. */ }
        const cachedUser = cached?.user;
        if (cachedUser) setUser(cachedUser);
        else setUser(null);
        setOffline(true);
      } else {
        api.logout();
        setUser(null);
        setHouseholds([]);
        setActiveHouseholdId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    let data = await api.login(email, password);
    const pendingInvitation = sessionStorage.getItem('postcards_pending_invitation');
    if (pendingInvitation) {
      await api.acceptInvitation(pendingInvitation);
      sessionStorage.removeItem('postcards_pending_invitation');
      data = await api.getMe();
    }
    setUser(data.user);
    setHouseholds(data.households || []);
    setActiveHouseholdId(data.active_household_id || null);
    setOffline(false);
    await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
    requestPersistentStorage();
    return data;
  }

  async function register(email, password, displayName) {
    const data = await api.register(email, password, displayName);
    setUser(data.user);
    setOffline(false);
    await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
    requestPersistentStorage();
    return data;
  }

  async function registerInvitation(token, displayName, password) {
    const data = await api.registerInvitation(token, displayName, password);
    setUser(data.user);
    setHouseholds(data.households || []);
    setActiveHouseholdId(data.active_household_id || null);
    setOffline(false);
    await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
    requestPersistentStorage();
    return data;
  }

  async function refreshAuth() {
    const data = await api.getMe();
    setUser(data.user);
    setHouseholds(data.households || []);
    setActiveHouseholdId(data.active_household_id || null);
    return data;
  }

  async function switchHousehold(householdId) {
    await api.switchHousehold(householdId);
    setActiveHouseholdId(Number(householdId));
    window.location.reload();
  }

  function logout() {
    const currentUser = user;
    api.logout();
    setUser(null);
    setHouseholds([]);
    setActiveHouseholdId(null);
    if (currentUser) clearOfflineData(currentUser.id);
  }

  return (
    <AuthContext.Provider value={{ user, households, activeHouseholdId, loading, offline, login, register, registerInvitation, refreshAuth, switchHousehold, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
