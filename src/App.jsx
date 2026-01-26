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
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-orange-50 flex items-center justify-center">
        <div className="text-ocean-blue text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DataProvider>
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-orange-50">
        <Header currentPage={page} setPage={setPage} />
        <main className="container mx-auto px-4 py-6">
          {page === 'dashboard' && <Dashboard />}
          {page === 'trips' && <TripsPage />}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'photos' && <PhotoAnalyzerPage setPage={setPage} />}
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
