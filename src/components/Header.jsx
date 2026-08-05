import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Briefcase, CalendarDays, Home, Image, Settings, ShieldCheck } from 'lucide-react';
import stampLogo from '../../assets/postcards-of-us-stamp.webp';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'journeys', label: 'Journeys', icon: Briefcase },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'trips', label: 'Memories', icon: Image },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'operations', label: 'Operations', icon: ShieldCheck, adminOnly: true },
];

export default function Header({ currentPage, setPage }) {
  const { user, households, activeHouseholdId, switchHousehold, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavItems = navItems.filter(item => !item.adminOnly || user?.site_admin);

  function navigate(id) {
    setPage(id);
    setMobileMenuOpen(false);
  }

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
            <span className="memory-brand-stamp" aria-hidden="true">
              <img src={stampLogo} alt="" />
            </span>
            <span className="memory-brand-subtitle">our story, one memory at a time</span>
          </button>

          <nav className="memory-nav hidden md:flex" aria-label="Main navigation">
            {visibleNavItems.map(item => (
              <NavButton key={item.id} item={item} active={currentPage === item.id} onNavigate={navigate} />
            ))}
          </nav>

          <div className="memory-user">
            {households.length > 0 && (
              <label className="hidden sm:block">
                <span className="sr-only">Memory site</span>
                <select
                  value={activeHouseholdId || ''}
                  onChange={event => switchHousehold(event.target.value)}
                  className="max-w-44 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white"
                >
                  {households.map(household => <option key={household.id} value={household.id} className="text-gray-900">{household.name}</option>)}
                </select>
              </label>
            )}
            <button
              type="button"
              className="memory-mobile-menu"
              onClick={() => setMobileMenuOpen(open => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
              <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
            <span className="hidden sm:block">{user?.display_name || user?.email}</span>
            <button type="button" onClick={logout} className="memory-signout">
              Sign out
            </button>
          </div>
        </div>

        <nav
          id="mobile-navigation"
          className={`memory-nav memory-nav-mobile md:hidden ${mobileMenuOpen ? 'is-open' : ''}`}
          aria-label="Mobile navigation"
        >
          {visibleNavItems.map(item => (
            <NavButton key={item.id} item={item} active={currentPage === item.id} onNavigate={navigate} />
          ))}
        </nav>
      </div>
    </header>
  );
}

function NavButton({ item, active, onNavigate }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className={active ? 'is-active' : ''}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}
