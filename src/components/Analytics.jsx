import React from 'react'
import { buildTravelDistanceSummary } from '../utils/travelDistance'

export default function Analytics({ trips = [], home = null }) {
  const totalTrips = trips.length
  const uniqueLocations = new Set(trips.map(t => t.location?.name || '')).size
  const distance = buildTravelDistanceSummary(trips, home)

  return (
    <div>
      <h3 className="font-medium mb-2">Analytics</h3>
      <div className="text-sm text-slate-700">
        <div>Total memories: <strong>{totalTrips}</strong></div>
        <div>Unique locations: <strong>{uniqueLocations}</strong></div>
        <div>Estimated round-trip miles: <strong>{Math.round(distance.totalMiles)}</strong></div>
      </div>
    </div>
  )
}
