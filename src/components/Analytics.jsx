import React from 'react'
import { totalDistanceMiles } from '../utils/calculations'

export default function Analytics({ trips = [] }) {
  const totalTrips = trips.length
  const uniqueLocations = new Set(trips.map(t => t.location?.name || '')).size
  const miles = totalDistanceMiles(trips)

  return (
    <div>
      <h3 className="font-medium mb-2">Analytics</h3>
      <div className="text-sm text-slate-700">
        <div>Total memories: <strong>{totalTrips}</strong></div>
        <div>Unique locations: <strong>{uniqueLocations}</strong></div>
        <div>Total miles (approx): <strong>{Math.round(miles)}</strong></div>
      </div>
    </div>
  )
}
