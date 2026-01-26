// Haversine formula and helpers
export function haversineDistance([lat1, lon1], [lat2, lon2]) {
  const toRad = v => (v * Math.PI) / 180
  const R = 3958.8 // miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function totalDistanceMiles(trips) {
  if (!trips || trips.length < 2) return 0
  // compute pairwise distance in chronological order where coordinates exist
  const coords = trips
    .map(t => t.location?.coordinates)
    .filter(Boolean)
  let sum = 0
  for (let i=1;i<coords.length;i++) {
    sum += haversineDistance([coords[i-1].lat, coords[i-1].lng], [coords[i].lat, coords[i].lng])
  }
  return sum
}
