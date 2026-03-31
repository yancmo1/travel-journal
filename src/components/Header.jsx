import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🗺️' },
  { id: 'trips', label: 'Trips', icon: '✈️' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'photos', label: 'Photo Intelligence', icon: '📸' },
];

export default function Header({ currentPage, setPage }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-gradient-to-r from-ocean-blue via-ocean-dark to-ocean-blue shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => setPage('dashboard')}
            className="flex items-center gap-2.5 group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🌅</span>
            <div className="leading-tight">
              <span className="text-base font-bold text-white">Our Adventures</span>
              <span className="hidden sm:block text-xs text-white/50 leading-none">travel journal</span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'bg-white/20 text-white shadow-inner'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {currentPage === item.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-ocean-teal ml-0.5" />
                )}
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <span className="text-white/70 text-sm hidden sm:block">
              👋 {user?.display_name || user?.username}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-all text-sm font-medium"
            >
              Sign Out
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {menuOpen && (
          <nav className="md:hidden pb-3 flex flex-col gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${
                  currentPage === item.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
