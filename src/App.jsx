import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TripsPage from './pages/TripsPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import JourneysPage from './pages/JourneysPage';
import SettingsPage from './pages/SettingsPage';
import OperationsPage from './pages/OperationsPage';
import TimelinePage from './pages/TimelinePage';
import SharedJourneyPage from './pages/SharedJourneyPage';
import InvitationPage from './pages/InvitationPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PwaStatus from './components/PwaStatus';
import PullToRefresh from './components/PullToRefresh';

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
    const params = new URLSearchParams(window.location.search);
    return window.location.pathname === '/login' || params.get('login') === '1' ? <LoginPage /> : <LandingPage />;
  }

  return (
    <DataProvider>
      <div className="min-h-screen app-shell">
        <Header currentPage={page} setPage={setPage} />
        <PwaStatus />
        <PullToRefresh />
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
          {page === 'operations' && user.site_admin && <OperationsPage />}
        </main>
      </div>
    </DataProvider>
  );
}

function AppRouter() {
  const params = new URLSearchParams(window.location.search);
  const invitationToken = params.get('invite');
  const resetToken = params.get('reset');
  const sharedMatch = window.location.pathname.match(/^\/share\/journey\/([^/]+)$/);
  const sharedToken = params.get('share');
  if (sharedMatch || sharedToken) return <SharedJourneyPage token={sharedToken || decodeURIComponent(sharedMatch[1])} />;
  if (invitationToken) return <InvitationPage token={invitationToken} />;
  if (resetToken) return <ResetPasswordPage token={resetToken} />;

  return <AppContent />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
