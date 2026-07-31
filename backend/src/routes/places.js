import { Router } from 'express';

const router = Router();
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const CACHE_TTL_MS = Number.parseInt(process.env.GOOGLE_PLACES_CACHE_TTL_MS || '300000', 10);
const CACHE_MAX_ENTRIES = Number.parseInt(process.env.GOOGLE_PLACES_CACHE_MAX_ENTRIES || '200', 10);
const searchCache = new Map();
const inFlightSearches = new Map();

function addressValue(components, type) {
  return components?.find(component => component.types?.includes(type))?.longText || '';
}

function toSearchResult(place) {
  const components = place.addressComponents || [];
  const address = {
    city: addressValue(components, 'locality') || addressValue(components, 'postal_town'),
    state: addressValue(components, 'administrative_area_level_1'),
    country: addressValue(components, 'country'),
    attraction: place.displayName?.text || '',
  };

  return {
    display_name: place.formattedAddress || place.displayName?.text || '',
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    type: place.types?.[0] || 'place',
    class: 'place',
    address,
  };
}

function normalizeQuery(query) {
  return query.replace(/\s+/g, ' ').trim().toLowerCase();
}

function getCachedResults(query) {
  const cached = searchCache.get(query);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(query);
    return null;
  }

  return cached.results;
}

function cacheResults(query, results) {
  searchCache.delete(query);
  searchCache.set(query, {
    results,
    expiresAt: Date.now() + Math.max(CACHE_TTL_MS, 0),
  });

  while (searchCache.size > Math.max(CACHE_MAX_ENTRIES, 1)) {
    searchCache.delete(searchCache.keys().next().value);
  }
}

async function fetchGoogleResults(query) {
  const response = await fetch(GOOGLE_PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types',
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 5,
      languageCode: 'en',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`Google Places search failed (${response.status}):`, details.slice(0, 500));
    throw new Error('Google Places search failed');
  }

  const data = await response.json();
  return (data.places || []).map(toSearchResult).filter(result => (
    Number.isFinite(result.lat) && Number.isFinite(result.lng)
  ));
}

router.get('/search', async (req, res, next) => {
  const query = String(req.query.q || '').trim();

  if (query.length < 2) {
    return res.status(400).json({ error: 'Search text is required' });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ error: 'Google Places search is not configured' });
  }

  const cacheKey = normalizeQuery(query);
  const cachedResults = getCachedResults(cacheKey);
  if (cachedResults) {
    res.set('X-Places-Cache', 'HIT');
    return res.json(cachedResults);
  }

  try {
    let request = inFlightSearches.get(cacheKey);
    if (!request) {
      request = fetchGoogleResults(query);
      inFlightSearches.set(cacheKey, request);
    }

    const results = await request;
    cacheResults(cacheKey, results);
    res.set('X-Places-Cache', 'MISS');
    res.json(results);

    if (inFlightSearches.get(cacheKey) === request) {
      inFlightSearches.delete(cacheKey);
    }
  } catch (err) {
    inFlightSearches.delete(cacheKey);
    if (err.message === 'Google Places search failed') {
      return res.status(502).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
