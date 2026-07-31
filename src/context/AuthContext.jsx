import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { clearOfflineData, getSnapshot, requestPersistentStorage, saveSnapshot } from '../utils/offlineStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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
    if (!api.getToken()) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
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
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const data = await api.login(username, password);
    setUser(data.user);
    setOffline(false);
    await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
    requestPersistentStorage();
    return data;
  }

  async function register(username, password, displayName) {
    const data = await api.register(username, password, displayName);
    setUser(data.user);
    setOffline(false);
    await Promise.all([saveSnapshot(data.user.id, { user: data.user }), saveSnapshot('last-user', { user: data.user })]);
    requestPersistentStorage();
    return data;
  }

  function logout() {
    const currentUser = user;
    api.logout();
    setUser(null);
    if (currentUser) clearOfflineData(currentUser.id);
  }

  return (
    <AuthContext.Provider value={{ user, loading, offline, login, register, logout }}>
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
