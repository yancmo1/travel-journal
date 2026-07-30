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
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
  const res = await rateLimitedFetch(url);
  
  if (!res.ok) throw new Error('Geocoding failed');
  
  const data = await res.json();
  return data.map(d => ({
    display_name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    type: d.type,
    class: d.class,
    address: d.address || {},
  }));
}

// Open-Meteo's GeoNames-backed endpoint supports partial city/place lookup.
export async function placeAutocomplete(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url);

  if (!res.ok) throw new Error('Place suggestions failed');

  const data = await res.json();
  return (data.results || []).map(place => {
    const displayParts = [place.name, place.admin1, place.country].filter(Boolean);
    return {
      display_name: [...new Set(displayParts)].join(', '),
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      type: place.feature_code,
      class: 'place',
      address: {
        city: place.name,
        state: place.admin1 || '',
        country: place.country || '',
      },
    };
  });
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
