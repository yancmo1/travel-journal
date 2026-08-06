// Haversine formula for great-circle distance
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// Calculate distance from home. Uses the signed-in user's saved home base when
// available, falling back to the HOME_LATITUDE/HOME_LONGITUDE env setting
// (historically Oklahoma City).
export function distanceFromHome(lat, lon, home = {}) {
  const homeLat = home.home_latitude != null ? Number(home.home_latitude) : (parseFloat(process.env.HOME_LATITUDE) || 35.4676);
  const homeLon = home.home_longitude != null ? Number(home.home_longitude) : (parseFloat(process.env.HOME_LONGITUDE) || -97.5164);
  return haversineDistance(homeLat, homeLon, lat, lon);
}

// Get decade from a year (e.g., 2023 -> 2020)
export function getDecade(year) {
  return Math.floor(year / 10) * 10;
}

// Calculate trip duration in days
export function tripDuration(startDate, endDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
}
