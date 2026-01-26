// Simple Nominatim search helper (respect rate limits client-side)
let lastRequest = 0;
const RATE_LIMIT_MS = 1000;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const timeSince = now - lastRequest;
  
  if (timeSince < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSince));
  }
  
  lastRequest = Date.now();
  return fetch(url, { headers: { 'Accept-Language': 'en' } });
}

export async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
  const res = await rateLimitedFetch(url);
  
  if (!res.ok) throw new Error('Geocoding failed');
  
  const data = await res.json();
  return data.map(d => ({
    display_name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    type: d.type,
    class: d.class,
  }));
}

export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await rateLimitedFetch(url);
  
  if (!res.ok) throw new Error('Reverse geocoding failed');
  
  const data = await res.json();
  return {
    display_name: data.display_name,
    address: data.address,
    country: data.address?.country,
    state: data.address?.state,
    city: data.address?.city || data.address?.town || data.address?.village,
  };
}
