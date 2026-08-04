import React from 'react';
import { useData } from '../context/DataContext';
import StatCard from '../components/StatCard';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
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

export default function AnalyticsPage() {
  const { analytics, loading } = useData();

  if (loading || !analytics) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-4">📊</span>
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  const { summary, duration, distance, frequency, types, travelers, funStats } = analytics;

  // Chart data
  const tripsPerYearData = {
    labels: Object.keys(frequency.tripsByYear || {}).sort(),
    datasets: [{
      label: 'Memories per Year',
      data: Object.keys(frequency.tripsByYear || {}).sort().map(y => frequency.tripsByYear[y]),
      backgroundColor: 'rgba(30, 58, 138, 0.7)',
      borderColor: 'rgb(30, 58, 138)',
      borderWidth: 1,
    }],
  };

  const tripTypeData = {
    labels: Object.keys(types || {}),
    datasets: [{
      data: Object.values(types || {}),
      backgroundColor: [
        'rgba(16, 185, 129, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(156, 163, 175, 0.8)',
      ],
    }],
  };

  const tripsByDecadeData = {
    labels: Object.keys(frequency.tripsByDecade || {}).sort().map(d => `${d}s`),
    datasets: [{
      label: 'Memories per Decade',
      data: Object.keys(frequency.tripsByDecade || {}).sort().map(d => frequency.tripsByDecade[d]),
      backgroundColor: 'rgba(244, 114, 182, 0.7)',
      borderColor: 'rgb(244, 114, 182)',
      borderWidth: 1,
    }],
  };

  const domesticVsIntlData = {
    labels: ['Domestic', 'International'],
    datasets: [{
      data: [funStats.domesticTrips || 0, funStats.internationalTrips || 0],
      backgroundColor: [
        'rgba(20, 184, 166, 0.8)',
        'rgba(251, 146, 60, 0.8)',
      ],
    }],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ocean-dark flex items-center gap-2">
        <span>📊</span> Travel Analytics
      </h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="✈️" label="Total Memories" value={summary.totalTrips} color="ocean" />
        <StatCard icon="📍" label="Locations" value={summary.uniqueLocations} color="teal" />
        <StatCard icon="🌍" label="Countries" value={summary.countries} color="sunset" />
        <StatCard icon="🏛️" label="States" value={summary.states} color="coral" />
      </div>

      {/* Duration & Distance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
            <span>⏱️</span> Duration Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-ocean-blue/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{duration.avgTripLength}</div>
              <div className="text-sm text-gray-500">Avg Memory Span (days)</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-ocean-teal/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{duration.longestTrip}</div>
              <div className="text-sm text-gray-500">Longest Memory Span (days)</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-sunset-orange/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{duration.shortestTrip}</div>
              <div className="text-sm text-gray-500">Shortest Memory Span (days)</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-coral-pink/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{duration.totalDays}</div>
              <div className="text-sm text-gray-500">Total Days Traveled</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
            <span>🛣️</span> Distance Stats
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-ocean-blue/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{distance.totalMiles?.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Miles All Time</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-ocean-teal/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{distance.milesThisYear?.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Miles This Year</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-sunset-orange/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{distance.milesThisDecade?.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Miles This Decade</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-coral-pink/10 to-transparent rounded-lg">
              <div className="text-2xl font-bold text-ocean-dark">{distance.furthestFromHome?.miles?.toLocaleString() || 0}</div>
              <div className="text-sm text-gray-500">Furthest From Home</div>
            </div>
          </div>
          {distance.furthestFromHome && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Furthest destination: <strong>{distance.furthestFromHome.location}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memories Per Year */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4">Memories Per Year</h2>
          <div className="h-64">
            <Bar
              data={tripsPerYearData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              }}
            />
          </div>
          {frequency.busiestYear && (
            <p className="mt-4 text-sm text-gray-500">
              Busiest year: <strong className="text-ocean-dark">{frequency.busiestYear}</strong>
            </p>
          )}
        </div>

        {/* Memory Types */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4">Memory Types</h2>
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={tripTypeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } },
              }}
            />
          </div>
        </div>
      </div>

      {/* More Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memories by Decade */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4">Memories Per Decade</h2>
          <div className="h-64">
            <Bar
              data={tripsByDecadeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              }}
            />
          </div>
        </div>

        {/* Domestic vs International */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4">Domestic vs International</h2>
          <div className="h-64 flex items-center justify-center">
            <Pie
              data={domesticVsIntlData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </div>
          <p className="mt-4 text-sm text-center text-gray-500">
            {funStats.internationalPct}% International
          </p>
        </div>
      </div>

      {/* Fun Stats */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
          <span>🌟</span> Fun Facts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {funStats.mostVisited && (
            <div className="p-4 bg-gradient-to-br from-sunrise-yellow/20 to-transparent rounded-lg">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-sm text-gray-500">Most Visited</div>
              <div className="font-semibold text-ocean-dark">{funStats.mostVisited.location}</div>
              <div className="text-sm text-gray-400">{funStats.mostVisited.count} visits</div>
            </div>
          )}
          
          {frequency.travelStreak > 0 && (
            <div className="p-4 bg-gradient-to-br from-coral-pink/20 to-transparent rounded-lg">
              <div className="text-3xl mb-2">🔥</div>
              <div className="text-sm text-gray-500">Travel Streak</div>
              <div className="font-semibold text-ocean-dark">{frequency.travelStreak} years</div>
              <div className="text-sm text-gray-400">consecutive travel</div>
            </div>
          )}
          
          {funStats.busiestMonth && (
            <div className="p-4 bg-gradient-to-br from-ocean-teal/20 to-transparent rounded-lg">
              <div className="text-3xl mb-2">📅</div>
              <div className="text-sm text-gray-500">Favorite Travel Month</div>
              <div className="font-semibold text-ocean-dark">{funStats.busiestMonth.month}</div>
              <div className="text-sm text-gray-400">{funStats.busiestMonth.count} memories</div>
            </div>
          )}

          {travelers.coupleOnlyTrips > 0 && (
            <div className="p-4 bg-gradient-to-br from-sunset-orange/20 to-transparent rounded-lg">
              <div className="text-3xl mb-2">💕</div>
              <div className="text-sm text-gray-500">Couple Only Memories</div>
              <div className="font-semibold text-ocean-dark">{travelers.coupleOnlyTrips}</div>
              <div className="text-sm text-gray-400">romantic getaways</div>
            </div>
          )}

          <div className="p-4 bg-gradient-to-br from-ocean-blue/20 to-transparent rounded-lg">
            <div className="text-3xl mb-2">📆</div>
              <div className="text-sm text-gray-500">Memories This Year</div>
            <div className="font-semibold text-ocean-dark">{frequency.tripsThisYear}</div>
            <div className="text-sm text-gray-400">{new Date().getFullYear()}</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-purple-200/40 to-transparent rounded-lg">
            <div className="text-3xl mb-2">🗓️</div>
              <div className="text-sm text-gray-500">Memories This Decade</div>
            <div className="font-semibold text-ocean-dark">{frequency.tripsThisDecade}</div>
            <div className="text-sm text-gray-400">2020s</div>
          </div>
        </div>
      </div>

      {/* Traveler Breakdown */}
      {travelers.breakdown && Object.keys(travelers.breakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-ocean-dark mb-4 flex items-center gap-2">
            <span>👨‍👩‍👧‍👦</span> Traveler Breakdown
          </h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(travelers.breakdown).map(([name, count]) => (
              <div key={name} className="px-4 py-3 bg-gray-50 rounded-lg text-center">
                <div className="font-semibold text-ocean-dark text-xl">{count}</div>
                <div className="text-sm text-gray-500">{name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
