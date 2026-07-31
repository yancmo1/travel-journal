import React from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Memories', icon: '✦' },
  { id: 'journeys', label: 'Our journeys', icon: '⌁' },
  { id: 'timeline', label: 'Timeline', icon: '↗' },
  { id: 'trips', label: 'All places', icon: '○' },
  { id: 'people', label: 'People', icon: '♧' },
  { id: 'cleanup', label: 'Clean up', icon: '✓' },
];

export default function Header({ currentPage, setPage }) {
  const { user, logout } = useAuth();

  return (
    <header className="memory-header">
      <div className="memory-header-inner">
        <div className="memory-header-row">
          <button
            type="button"
            className="memory-brand"
            onClick={() => setPage('dashboard')}
            aria-label="Go to memories"
          >
            <span className="memory-brand-mark" aria-hidden="true">W</span>
            <span>
              <span className="memory-brand-title">Where We’ve Been</span>
              <span className="memory-brand-subtitle">our life, one trip at a time</span>
            </span>
          </button>

          <nav className="memory-nav hidden md:flex" aria-label="Main navigation">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={currentPage === item.id ? 'is-active' : ''}
                aria-current={currentPage === item.id ? 'page' : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="memory-user">
            <span className="hidden sm:block">{user?.display_name || user?.username}</span>
            <button type="button" onClick={logout} className="memory-signout">
              Sign out
            </button>
          </div>
        </div>

        <nav className="memory-nav memory-nav-mobile md:hidden" aria-label="Mobile navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={currentPage === item.id ? 'is-active' : ''}
              aria-current={currentPage === item.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
