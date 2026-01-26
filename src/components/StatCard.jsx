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
    <div className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-2xl`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-ocean-dark truncate">
            {value}
          </div>
          <div className="text-sm text-gray-500">{label}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}
