import React from 'react';

const colorClasses = {
  forest: 'from-brand-forest-700 to-brand-forest-900',
  terracotta: 'from-brand-terracotta-500 to-brand-terracotta-700',
  brass: 'from-brand-brass-500 to-brand-brass-700',
};

export default function StatCard({ icon, label, value, color = 'forest', subtitle }) {
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
