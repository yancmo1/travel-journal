import React from 'react';

const colorClasses = {
  ocean: 'from-ocean-blue to-ocean-dark',
  teal: 'from-ocean-teal to-teal-600',
  sunset: 'from-sunset-orange to-orange-500',
  coral: 'from-coral-pink to-pink-500',
  yellow: 'from-sunrise-yellow to-yellow-500',
};

export default function StatCard({ icon, label, value, color = 'ocean', subtitle }) {
  return (
    <div className={`dashboard-stat dashboard-stat-${color}`}>
      <div className="dashboard-stat-icon">{icon}</div>
      <div className="dashboard-stat-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}
