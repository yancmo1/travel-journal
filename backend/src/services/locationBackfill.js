import { query } from '../utils/db.js';
import { reverseGeocode } from '../utils/geocoding.js';

export async function getLocationBackfillCandidates(userId) {
  const result = await query(`
    SELECT DISTINCT ON (t.id)
      t.id AS trip_id,
      t.location_name,
      t.start_date,
      t.date_label,
      p.id AS photo_id,
      p.latitude,
      p.longitude,
      p.date_taken
    FROM trips t
    JOIN photos p ON p.trip_id = t.id
    WHERE t.created_by = $1
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND (
        t.location_name IS NULL
        OR BTRIM(t.location_name) = ''
        OR LOWER(t.location_name) LIKE 'unknown%'
      )
    ORDER BY t.id, p.date_taken NULLS LAST, p.id
    `, [userId]);

  return result.rows;
}

export async function backfillPhotoLocations(userId) {
  const candidates = await getLocationBackfillCandidates(userId);
  const updated = [];
  const skipped = [];

  for (const candidate of candidates) {
    const latitude = Number(candidate.latitude);
    const longitude = Number(candidate.longitude);
    const location = await reverseGeocode(latitude, longitude);

    if (!location || location.locationName === 'Unknown Location') {
      skipped.push({ ...candidate, reason: 'No place match found' });
      continue;
    }

    const result = await query(`
      UPDATE trips SET
        location_name = $1,
        city = COALESCE(NULLIF(city, ''), $2),
        state = COALESCE(NULLIF(state, ''), $3),
        country = COALESCE(NULLIF(country, ''), $4),
        latitude = COALESCE(latitude, $5),
        longitude = COALESCE(longitude, $6),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND created_by = $8
        AND (
          location_name IS NULL
          OR BTRIM(location_name) = ''
          OR LOWER(location_name) LIKE 'unknown%'
        )
      RETURNING *
    `, [
      location.displayName,
      location.city || location.locationName,
      location.state,
      location.country,
      latitude,
      longitude,
      candidate.trip_id,
      userId,
    ]);

    if (result.rows.length) {
      updated.push({
        tripId: candidate.trip_id,
        photoId: candidate.photo_id,
        previousName: candidate.location_name,
        locationName: location.displayName,
        city: location.city || location.locationName,
        state: location.state,
        country: location.country,
        latitude,
        longitude,
      });
    } else {
      skipped.push({ ...candidate, reason: 'Memory was already updated' });
    }
  }

  return { found: candidates.length, updated, skipped };
}
