import React from 'react';
import { useData } from '../context/DataContext';
import StatCard from '../components/StatCard';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CHART_OPTS_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
};

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-base font-semibold text-ocean-dark">{title}</h2>
    </div>
  );
}

function MiniStat({ value, label, accent }) {
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${accent} to-transparent`}>
      <div className="text-xl font-bold text-ocean-dark">{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { analytics, loading } = useData();

  if (loading || !analytics) {
    return (
      <div className="text-center py-16">
        <span className="text-4xl block mb-4 animate-pulse">📊</span>
        <p className="text-gray-400">Loading analytics…</p>
      </div>
    );
  }

  const { summary, duration, distance, frequency, types, travelers, funStats } = analytics;

  const tripsPerYearData = {
    labels: Object.keys(frequency.tripsByYear || {}).sort(),
    datasets: [{
      label: 'Trips',
      data: Object.keys(frequency.tripsByYear || {}).sort().map(y => frequency.tripsByYear[y]),
      backgroundColor: 'rgba(30, 58, 138, 0.75)',
      borderColor: 'rgb(30, 58, 138)',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const tripTypeData = {
    labels: Object.keys(types || {}),
    datasets: [{
      data: Object.values(types || {}),
      backgroundColor: [
        'rgba(16, 185, 129, 0.85)',
        'rgba(59, 130, 246, 0.85)',
        'rgba(139, 92, 246, 0.85)',
        'rgba(251, 146, 60, 0.85)',
        'rgba(156, 163, 175, 0.85)',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const tripsByDecadeData = {
    labels: Object.keys(frequency.tripsByDecade || {}).sort().map(d => `${d}s`),
    datasets: [{
      label: 'Trips',
      data: Object.keys(frequency.tripsByDecade || {}).sort().map(d => frequency.tripsByDecade[d]),
      backgroundColor: 'rgba(251, 113, 133, 0.75)',
      borderColor: 'rgb(251, 113, 133)',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const domesticVsIntlData = {
    labels: ['Domestic', 'International'],
    datasets: [{
      data: [funStats.domesticTrips || 0, funStats.internationalTrips || 0],
      backgroundColor: [
        'rgba(20, 184, 166, 0.85)',
        'rgba(251, 146, 60, 0.85)',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-ocean-dark flex items-center gap-2">
          📊 Travel Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your complete journey in numbers</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="✈️" label="Total Trips"  value={summary.totalTrips}        color="ocean" />
        <StatCard icon="📍" label="Locations"    value={summary.uniqueLocations}    color="teal" />
        <StatCard icon="🌍" label="Countries"    value={summary.countries}          color="sunset" />
        <StatCard icon="🏛️" label="States"       value={summary.states}             color="coral" />
      </div>

      {/* Duration & Distance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="⏱️" title="Duration" />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat value={duration.avgTripLength}  label="Avg trip length (days)" accent="from-ocean-blue/10" />
            <MiniStat value={duration.longestTrip}    label="Longest trip (days)"    accent="from-ocean-teal/10" />
            <MiniStat value={duration.shortestTrip}   label="Shortest trip (days)"   accent="from-sunset-orange/10" />
            <MiniStat value={duration.totalDays}      label="Total days traveled"    accent="from-rose-warm/10" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="🛣️" title="Distance" />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat value={distance.totalMiles?.toLocaleString()}        label="Miles all time"      accent="from-ocean-blue/10" />
            <MiniStat value={distance.milesThisYear?.toLocaleString()}     label="Miles this year"     accent="from-ocean-teal/10" />
            <MiniStat value={distance.milesThisDecade?.toLocaleString()}   label="Miles this decade"   accent="from-sunset-orange/10" />
            <MiniStat value={distance.furthestFromHome?.miles?.toLocaleString() || 0} label="Furthest from home" accent="from-rose-warm/10" />
          </div>
          {distance.furthestFromHome && (
            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              Furthest: <strong className="text-ocean-dark">{distance.furthestFromHome.location}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="📅" title="Trips Per Year" />
          <div className="h-56">
            <Bar data={tripsPerYearData} options={CHART_OPTS_BASE} />
          </div>
          {frequency.busiestYear && (
            <p className="mt-3 text-xs text-gray-500">
              Busiest year: <strong className="text-ocean-dark">{frequency.busiestYear}</strong>
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="🗂️" title="Trip Types" />
          <div className="h-56 flex items-center justify-center">
            <Doughnut
              data={tripTypeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } } },
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="🗓️" title="Trips Per Decade" />
          <div className="h-56">
            <Bar data={tripsByDecadeData} options={CHART_OPTS_BASE} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="🌐" title="Domestic vs International" />
          <div className="h-56 flex items-center justify-center">
            <Pie
              data={domesticVsIntlData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
              }}
            />
          </div>
          <p className="mt-3 text-xs text-center text-gray-500">
            {funStats.internationalPct}% international
          </p>
        </div>
      </div>

      {/* Fun Facts */}
      <div className="bg-white rounded-xl shadow-md p-5">
        <SectionHeader icon="🌟" title="Fun Facts" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {funStats.mostVisited && (
            <FunFact icon="🏆" label="Most Visited" value={funStats.mostVisited.location} sub={`${funStats.mostVisited.count} visits`} accent="from-sunrise-yellow/20" />
          )}
          {(frequency.travelStreak > 0) && (
            <FunFact icon="🔥" label="Travel Streak" value={`${frequency.travelStreak} years`} sub="consecutive" accent="from-rose-warm/15" />
          )}
          {funStats.busiestMonth && (
            <FunFact icon="📅" label="Favourite Month" value={funStats.busiestMonth.month} sub={`${funStats.busiestMonth.count} trips`} accent="from-ocean-teal/15" />
          )}
          {travelers.coupleOnlyTrips > 0 && (
            <FunFact icon="💕" label="Just the Two of You" value={travelers.coupleOnlyTrips} sub="couple-only trips" accent="from-coral-pink/15" />
          )}
          <FunFact icon="📆" label="Trips This Year"   value={frequency.tripsThisYear}   sub={String(new Date().getFullYear())} accent="from-ocean-blue/10" />
          <FunFact icon="🗓️" label="Trips This Decade" value={frequency.tripsThisDecade} sub="2020s"                              accent="from-lavender/15" />
        </div>
      </div>

      {/* Traveler Breakdown */}
      {travelers.breakdown && Object.keys(travelers.breakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-5">
          <SectionHeader icon="👥" title="Traveler Breakdown" />
          <div className="flex flex-wrap gap-3">
            {Object.entries(travelers.breakdown).map(([name, count]) => (
              <div key={name} className="px-5 py-3 bg-gray-50 rounded-xl text-center border border-gray-100">
                <div className="text-2xl font-bold text-ocean-dark">{count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FunFact({ icon, label, value, sub, accent }) {
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${accent} to-transparent`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-ocean-dark text-sm">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
