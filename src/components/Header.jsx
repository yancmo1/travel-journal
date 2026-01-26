import React from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🗺️' },
  { id: 'trips', label: 'Trips', icon: '✈️' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'photos', label: 'Photo Intelligence', icon: '📸' },
];

export default function Header({ currentPage, setPage }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-gradient-to-r from-ocean-blue to-ocean-dark shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌅</span>
            <h1 className="text-xl font-bold text-white">
              Travel Memory Tracker
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  currentPage === item.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <span className="text-white/80 text-sm hidden sm:block">
              Welcome, {user?.display_name || user?.username}
            </span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-sunset-orange hover:bg-coral-pink text-white rounded-lg transition-colors text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex justify-center gap-2 pb-3">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1 ${
                currentPage === item.id
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
