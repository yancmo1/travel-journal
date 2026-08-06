import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../utils/db.js';
import { distanceFromHome } from '../utils/calculations.js';

const router = Router();
const photoStoragePath = process.env.PHOTO_STORAGE_PATH || '/app/media/travel-photos';

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number).filter(id => Number.isInteger(id) && id > 0))];
}

async function removePhotoDirectories(ids) {
  const results = await Promise.allSettled(
    ids.map(id => fs.rm(path.join(photoStoragePath, String(id)), { recursive: true, force: true }))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to remove photo directory for trip ${ids[index]}:`, result.reason);
    }
  });
}

// Get all trips
router.get('/', async (req, res, next) => {
  try {
    const { year, tripType, travelerId } = req.query;
    
    let sql = `
      SELECT t.*, j.title AS journey_title,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', tr.id, 'name', tr.name, 'relationship', tr.relationship)) 
          FILTER (WHERE tr.id IS NOT NULL), 
          '[]'
        ) as travelers,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', p2.id,
            'filename', p2.filename,
            'file_path', p2.file_path,
            'thumbnail_path', p2.thumbnail_path,
            'date_taken', p2.date_taken,
            'caption', p2.caption,
            'sort_order', p2.sort_order,
            'is_cover', p2.is_cover,
            'rotation', p2.rotation
          ) ORDER BY p2.is_cover DESC, p2.sort_order ASC, p2.date_taken NULLS LAST, p2.uploaded_at, p2.id)
          FROM photos p2
          WHERE p2.trip_id = t.id
        ), '[]') AS photos
      FROM trips t
      LEFT JOIN journeys j ON t.journey_id = j.id AND j.created_by = $1
      LEFT JOIN trip_travelers tt ON t.id = tt.trip_id
      LEFT JOIN travelers tr ON tt.traveler_id = tr.id
    `;
    
    const conditions = [];
    const params = [req.user.id];
    let paramIndex = 2;
    conditions.push('t.created_by = $1');

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM t.start_date) = $${paramIndex}`);
      params.push(year);
      paramIndex++;
    }

    if (tripType) {
      conditions.push(`t.trip_type = $${paramIndex}`);
      params.push(tripType);
      paramIndex++;
    }

    if (travelerId) {
      conditions.push(`tt.traveler_id = $${paramIndex}`);
      params.push(travelerId);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY t.id, j.title ORDER BY t.start_date DESC NULLS LAST, t.id DESC';

    const result = await query(sql, params);
    if (String(req.query.paginate).toLowerCase() === 'true') {
      return res.json({ items: result.rows, next_cursor: null });
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single trip
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tripResult = await query('SELECT * FROM trips WHERE id = $1 AND created_by = $2', [id, req.user.id]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];

    // Get travelers
    const travelersResult = await query(`
      SELECT tr.* FROM travelers tr
      JOIN trip_travelers tt ON tr.id = tt.traveler_id
      WHERE tt.trip_id = $1
    `, [id]);
    trip.travelers = travelersResult.rows;

    // Get photos
    const photosResult = await query(`
      SELECT * FROM photos
      WHERE trip_id = $1
      ORDER BY is_cover DESC, sort_order ASC, date_taken NULLS LAST, uploaded_at, id
    `, [id]);
    trip.photos = photosResult.rows;

    res.json(trip);
  } catch (err) {
    next(err);
  }
});

// Create trip
router.post('/', async (req, res, next) => {
  try {
    const {
      locationName, placeName, formattedAddress, city, latitude, longitude, country, state,
      startDate, endDate, dateLabel, datePrecision, tripType, notes, travelerIds
    } = req.body;

    const homeDist = latitude && longitude ? distanceFromHome(latitude, longitude, req.user) : null;

    const result = await query(`
      INSERT INTO trips (
        location_name, place_name, formatted_address, city, latitude, longitude, country, state,
        start_date, end_date, date_label, date_precision,
        trip_type, notes, home_distance_miles, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      locationName, placeName || null, formattedAddress || null, city || null, latitude, longitude, country, state,
      startDate || null, endDate || null, dateLabel || null, datePrecision || 'exact',
      tripType, notes, homeDist, req.user.id
    ]);

    const trip = result.rows[0];

    // Add travelers
    if (travelerIds && travelerIds.length > 0) {
      const allowedTravelers = await query(`
        SELECT id FROM travelers
        WHERE id = ANY($1::int[])
          AND (created_by = $2 OR EXISTS (
            SELECT 1 FROM trip_travelers existing_tt
            JOIN trips owned_trip ON owned_trip.id = existing_tt.trip_id
            WHERE existing_tt.traveler_id = travelers.id AND owned_trip.created_by = $2
          ))
      `, [travelerIds, req.user.id]);
      const allowedIds = new Set(allowedTravelers.rows.map(row => row.id));
      for (const tId of travelerIds) {
        if (!allowedIds.has(Number(tId))) continue;
        await query(
          'INSERT INTO trip_travelers (trip_id, traveler_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [trip.id, tId]
        );
      }
    }

    // Fetch full trip with travelers
    const fullTrip = await query(`
      SELECT t.*, json_agg(tr.*) as travelers
      FROM trips t
      LEFT JOIN trip_travelers tt ON t.id = tt.trip_id
      LEFT JOIN travelers tr ON tt.traveler_id = tr.id
      WHERE t.id = $1 AND t.created_by = $2
      GROUP BY t.id
    `, [trip.id, req.user.id]);

    res.status(201).json(fullTrip.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update trip
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      locationName, placeName, formattedAddress, city, latitude, longitude, country, state,
      startDate, endDate, dateLabel, datePrecision, tripType, notes, travelerIds
    } = req.body;

    const homeDist = latitude && longitude ? distanceFromHome(latitude, longitude, req.user) : null;

    const result = await query(`
      UPDATE trips SET
        location_name = $1, place_name = $2, formatted_address = $3, city = $4, latitude = $5, longitude = $6, country = $7, state = $8,
        start_date = $9, end_date = $10, date_label = $11, date_precision = $12,
        trip_type = $13, notes = $14, home_distance_miles = $15, updated_at = NOW()
      WHERE id = $16 AND created_by = $17
      RETURNING *
    `, [
      locationName, placeName || null, formattedAddress || null, city || null, latitude, longitude, country, state,
      startDate || null, endDate || null, dateLabel || null, datePrecision || 'exact',
      tripType, notes, homeDist, id, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Update travelers
    await query('DELETE FROM trip_travelers WHERE trip_id = $1', [id]);
    if (travelerIds && travelerIds.length > 0) {
      const allowedTravelers = await query(`
        SELECT id FROM travelers
        WHERE id = ANY($1::int[])
          AND (created_by = $2 OR EXISTS (
            SELECT 1 FROM trip_travelers existing_tt
            JOIN trips owned_trip ON owned_trip.id = existing_tt.trip_id
            WHERE existing_tt.traveler_id = travelers.id AND owned_trip.created_by = $2
          ))
      `, [travelerIds, req.user.id]);
      const allowedIds = new Set(allowedTravelers.rows.map(row => row.id));
      for (const tId of travelerIds) {
        if (!allowedIds.has(Number(tId))) continue;
        await query(
          'INSERT INTO trip_travelers (trip_id, traveler_id) VALUES ($1, $2)',
          [id, tId]
        );
      }
    }

    // Fetch complete trip
    const fullTrip = await query(`
      SELECT t.*, COALESCE(json_agg(tr.*) FILTER (WHERE tr.id IS NOT NULL), '[]') as travelers
      FROM trips t
      LEFT JOIN trip_travelers tt ON t.id = tt.trip_id
      LEFT JOIN travelers tr ON tt.traveler_id = tr.id
      WHERE t.id = $1 AND t.created_by = $2
      GROUP BY t.id
    `, [id, req.user.id]);

    res.json(fullTrip.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete several memories during a confirmed cleanup operation.
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = normalizeIds(req.body.ids);

    if (ids.length === 0) {
      return res.status(400).json({ error: 'Choose at least one memory to delete' });
    }

    if (ids.length > 200) {
      return res.status(400).json({ error: 'Delete no more than 200 memories at once' });
    }

    const result = await query(
      'DELETE FROM trips WHERE id = ANY($1::int[]) AND created_by = $2 RETURNING id',
      [ids, req.user.id]
    );
    const deletedIds = result.rows.map(row => row.id);

    await removePhotoDirectories(deletedIds);
    res.json({ deletedIds, count: deletedIds.length });
  } catch (err) {
    next(err);
  }
});

// Delete trip
router.delete('/:id', async (req, res, next) => {
  try {
    const [id] = normalizeIds([req.params.id]);
    if (!id) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    const result = await query('DELETE FROM trips WHERE id = $1 AND created_by = $2 RETURNING id', [id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    await removePhotoDirectories([id]);
    res.json({ message: 'Trip deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;
