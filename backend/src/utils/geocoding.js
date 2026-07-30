/**
 * Reverse Geocoding using OpenStreetMap Nominatim API
 * Converts GPS coordinates to location names
 * 
 * Rate Limit: 1 request per second
 * Documentation: https://nominatim.org/release-docs/latest/api/Reverse/
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'WhereWeveBeen/1.0 (https://travel.yancmo.xyz)';
const REQUEST_DELAY = 1100; // >1 second to respect rate limit

// In-memory cache to avoid redundant lookups
const geocodeCache = new Map();

// Request queue for rate limiting
let lastRequestTime = 0;

/**
 * Reverse geocode coordinates to location name
 */
export async function reverseGeocode(latitude, longitude) {
  // Check cache first
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Rate limiting - wait if needed
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await sleep(REQUEST_DELAY - timeSinceLastRequest);
  }

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.append('lat', latitude);
    url.searchParams.append('lon', longitude);
    url.searchParams.append('format', 'json');
    url.searchParams.append('zoom', '10'); // City/town level
    url.searchParams.append('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    lastRequestTime = Date.now();

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.error) {
      return null;
    }

    const location = parseNominatimResponse(data);
    
    // Cache the result
    geocodeCache.set(cacheKey, location);
    
    // Limit cache size to prevent memory issues
    if (geocodeCache.size > 1000) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }

    return location;
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return null;
  }
}

/**
 * Parse Nominatim response to extract location details
 */
function parseNominatimResponse(data) {
  const address = data.address || {};

  // Determine location name (try multiple fields)
  const locationName = 
    address.city || 
    address.town || 
    address.village || 
    address.municipality || 
    address.county ||
    data.display_name?.split(',')[0] ||
    'Unknown Location';

  // Get state/region
  const state = address.state || address.region || null;

  // Get country
  const country = address.country || null;
  const countryCode = address.country_code?.toUpperCase() || null;

  // Build display name
  const displayParts = [locationName];
  if (state && state !== locationName) {
    displayParts.push(state);
  }
  if (country && country !== locationName && country !== state) {
    displayParts.push(country);
  }

  return {
    locationName,
    displayName: displayParts.join(', '),
    city: address.city || address.town || null,
    state,
    county: address.county || null,
    country,
    countryCode,
    latitude: parseFloat(data.lat),
    longitude: parseFloat(data.lon),
    fullAddress: data.display_name
  };
}

/**
 * Batch reverse geocode multiple coordinates
 * Respects rate limiting (1 req/sec)
 */
export async function batchReverseGeocode(coordinates) {
  const results = [];

  for (const coord of coordinates) {
    const location = await reverseGeocode(coord.latitude, coord.longitude);
    results.push({
      ...coord,
      location
    });
  }

  return results;
}

/**
 * Check if coordinates are approximately the same location
 * Returns true if within ~1km of each other
 */
export function areCoordinatesClose(lat1, lon1, lat2, lon2, thresholdKm = 1) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= thresholdKm;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Clear geocode cache (useful for testing)
 */
export function clearGeocodeCache() {
  geocodeCache.clear();
}

export default {
  reverseGeocode,
  batchReverseGeocode,
  areCoordinatesClose,
  clearGeocodeCache
};
