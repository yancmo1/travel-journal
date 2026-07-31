import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TripsPage from './pages/TripsPage';
import LoginPage from './pages/LoginPage';
import JourneysPage from './pages/JourneysPage';
import SettingsPage from './pages/SettingsPage';
import TimelinePage from './pages/TimelinePage';
import SharedJourneyPage from './pages/SharedJourneyPage';
import PwaStatus from './components/PwaStatus';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [travelerFilter, setTravelerFilter] = useState('all');

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
      <div className="min-h-screen app-shell">
        <Header currentPage={page} setPage={setPage} />
        <PwaStatus />
        <main className="memory-main">
          {page === 'dashboard' && <Dashboard setPage={setPage} />}
          {page === 'journeys' && <JourneysPage />}
          {page === 'timeline' && <TimelinePage setPage={setPage} />}
          {page === 'trips' && <TripsPage initialTravelerFilter={travelerFilter} />}
          {page === 'settings' && (
            <SettingsPage
              setPage={setPage}
              setTravelerFilter={setTravelerFilter}
            />
          )}
        </main>
      </div>
    </DataProvider>
  );
}

export default function App() {
  const sharedMatch = window.location.pathname.match(/^\/share\/journey\/([^/]+)$/);
  if (sharedMatch) return <SharedJourneyPage token={decodeURIComponent(sharedMatch[1])} />;

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
