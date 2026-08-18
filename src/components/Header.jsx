import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Briefcase, CalendarDays, Compass, Home, Image, Settings, ShieldCheck } from 'lucide-react';
import logo from '../../assets/postcards-of-us-logo.png';
import api from '../utils/api';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'trips', label: 'Memories', icon: Image },
  { id: 'journeys', label: 'Journeys', icon: Briefcase },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'getting-started', label: 'Getting Started', icon: Compass },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'operations', label: 'Operations', icon: ShieldCheck, adminOnly: true },
];

export default function Header({ currentPage, setPage }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (!user) return undefined;
    api.getOnboarding().then(progress => { if (mounted) setOnboardingComplete(progress.completed); }).catch(() => {});
    function completed() { setOnboardingComplete(true); }
    window.addEventListener('postcards-onboarding-completed', completed);
    return () => { mounted = false; window.removeEventListener('postcards-onboarding-completed', completed); };
  }, [user?.id]);
  const visibleNavItems = navItems.filter(item => (item.id !== 'getting-started' || !onboardingComplete) && (!item.adminOnly || user?.site_admin));
  const mobileNavItems = visibleNavItems.filter(item => !item.adminOnly);

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
            <span className="memory-brand-stamp">
              <img src={logo} alt="Postcards of Us" width="1254" height="1584" />
            </span>
          </button>

          <nav className="memory-nav hidden md:flex" aria-label="Main navigation">
            {visibleNavItems.map(item => (
              <NavButton key={item.id} item={item} active={currentPage === item.id} onNavigate={navigate} />
            ))}
          </nav>

          <div className="memory-user">
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
          {mobileNavItems.map(item => (
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
