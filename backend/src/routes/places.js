import { Router } from 'express';

const router = Router();
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

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

router.get('/search', async (req, res, next) => {
  const query = String(req.query.q || '').trim();

  if (query.length < 2) {
    return res.status(400).json({ error: 'Search text is required' });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ error: 'Google Places search is not configured' });
  }

  try {
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
      return res.status(502).json({ error: 'Google Places search failed' });
    }

    const data = await response.json();
    res.json((data.places || []).map(toSearchResult).filter(result => (
      Number.isFinite(result.lat) && Number.isFinite(result.lng)
    )));
  } catch (err) {
    next(err);
  }
});

export default router;
