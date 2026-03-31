import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TripsPage from './pages/TripsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PhotoAnalyzerPage from './pages/PhotoAnalyzerPage';
import LoginPage from './pages/LoginPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ocean-blue via-sky-500 to-sunset-orange flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl block mb-4 animate-pulse">🌅</span>
          <p className="text-white/80 text-lg font-medium">Loading your adventures…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  function navigate(newPage) {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <DataProvider>
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-orange-50">
        <Header currentPage={page} setPage={navigate} />
        <main className="container mx-auto px-4 py-6">
          <div key={page} className="page-enter">
            {page === 'dashboard' && <Dashboard />}
            {page === 'trips' && <TripsPage />}
            {page === 'analytics' && <AnalyticsPage />}
            {page === 'photos' && <PhotoAnalyzerPage setPage={navigate} />}
          </div>
        </main>
      </div>
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
