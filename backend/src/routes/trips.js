import { Router } from 'express';
import { query } from '../utils/db.js';
import { distanceFromHome } from '../utils/calculations.js';

const router = Router();

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
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', p.id,
            'filename', p.filename,
            'file_path', p.file_path,
            'thumbnail_path', p.thumbnail_path,
            'date_taken', p.date_taken
          ))
          FILTER (WHERE p.id IS NOT NULL), 
          '[]'
        ) as photos
      FROM trips t
      LEFT JOIN journeys j ON t.journey_id = j.id
      LEFT JOIN trip_travelers tt ON t.id = tt.trip_id
      LEFT JOIN travelers tr ON tt.traveler_id = tr.id
      LEFT JOIN photos p ON t.id = p.trip_id
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;

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
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get single trip
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const tripResult = await query('SELECT * FROM trips WHERE id = $1', [id]);
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
    const photosResult = await query('SELECT * FROM photos WHERE trip_id = $1', [id]);
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
      locationName, city, latitude, longitude, country, state,
      startDate, endDate, dateLabel, datePrecision, tripType, notes, travelerIds
    } = req.body;

    const homeDist = latitude && longitude ? distanceFromHome(latitude, longitude) : null;

    const result = await query(`
      INSERT INTO trips (
        location_name, city, latitude, longitude, country, state,
        start_date, end_date, date_label, date_precision,
        trip_type, notes, home_distance_miles, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      locationName, city || null, latitude, longitude, country, state,
      startDate || null, endDate || null, dateLabel || null, datePrecision || 'exact',
      tripType, notes, homeDist, req.user.id
    ]);

    const trip = result.rows[0];

    // Add travelers
    if (travelerIds && travelerIds.length > 0) {
      for (const tId of travelerIds) {
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
      WHERE t.id = $1
      GROUP BY t.id
    `, [trip.id]);

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
      locationName, city, latitude, longitude, country, state,
      startDate, endDate, dateLabel, datePrecision, tripType, notes, travelerIds
    } = req.body;

    const homeDist = latitude && longitude ? distanceFromHome(latitude, longitude) : null;

    const result = await query(`
      UPDATE trips SET
        location_name = $1, city = $2, latitude = $3, longitude = $4, country = $5, state = $6,
        start_date = $7, end_date = $8, date_label = $9, date_precision = $10,
        trip_type = $11, notes = $12, home_distance_miles = $13, updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      locationName, city || null, latitude, longitude, country, state,
      startDate || null, endDate || null, dateLabel || null, datePrecision || 'exact',
      tripType, notes, homeDist, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Update travelers
    await query('DELETE FROM trip_travelers WHERE trip_id = $1', [id]);
    if (travelerIds && travelerIds.length > 0) {
      for (const tId of travelerIds) {
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
      WHERE t.id = $1
      GROUP BY t.id
    `, [id]);

    res.json(fullTrip.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete trip
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM trips WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json({ message: 'Trip deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;
