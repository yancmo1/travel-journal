import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Auto-login with mock user (auth disabled)
  const [user, setUser] = useState({ id: 1, username: 'demo', display_name: 'Demo User' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-login - set a dummy token for API calls
    if (!localStorage.getItem('travel_token')) {
      localStorage.setItem('travel_token', 'demo-token');
    }
  }, []);

  async function checkAuth() {
    // Auth disabled - always logged in
    return;
  }

  async function login(username, password) {
    const data = await api.login(username, password);
    setUser(data.user);
    return data;
  }

  async function register(username, password, displayName) {
    const data = await api.register(username, password, displayName);
    setUser(data.user);
    return data;
  }

  function logout() {
    api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
