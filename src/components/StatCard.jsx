import React from 'react';

const colorClasses = {
  ocean:  { gradient: 'from-ocean-blue to-indigo-600',   accent: 'border-ocean-blue/30' },
  teal:   { gradient: 'from-ocean-teal to-teal-500',     accent: 'border-ocean-teal/30' },
  sunset: { gradient: 'from-sunset-orange to-orange-500', accent: 'border-sunset-orange/30' },
  coral:  { gradient: 'from-rose-warm to-coral-pink',    accent: 'border-rose-warm/30' },
  yellow: { gradient: 'from-sunrise-yellow to-amber-400', accent: 'border-sunrise-yellow/30' },
};

export default function StatCard({ icon, label, value, color = 'ocean', subtitle }) {
  const { gradient, accent } = colorClasses[color] || colorClasses.ocean;

  return (
    <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 p-5 border-l-4 ${accent}`}>
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-ocean-dark truncate leading-tight">
            {value}
          </div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
          {subtitle && (
            <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}
