import { Router } from 'express';
import { query } from '../utils/db.js';

const router = Router();

// Get all travelers
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const activeCondition = includeInactive ? '' : 'AND tr.is_active = true';
    const result = await query(`
      SELECT DISTINCT tr.*
      FROM travelers tr
      LEFT JOIN trip_travelers tt ON tt.traveler_id = tr.id
      LEFT JOIN trips owned_trip ON owned_trip.id = tt.trip_id AND owned_trip.created_by = $1
      WHERE (tr.created_by = $1 OR owned_trip.id IS NOT NULL) ${activeCondition}
      ORDER BY tr.is_active DESC, tr.created_at
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Create traveler
router.post('/', async (req, res, next) => {
  try {
    const { name, relationship } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(
      'INSERT INTO travelers (name, relationship, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, relationship || 'other', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update traveler
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, relationship, isActive } = req.body;

    const result = await query(
      `UPDATE travelers SET name = COALESCE($1, name), relationship = COALESCE($2, relationship), is_active = COALESCE($3, is_active)
       WHERE id = $4 AND (created_by = $5 OR EXISTS (
         SELECT 1 FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id
         WHERE tt.traveler_id = travelers.id AND t.created_by = $5
       )) RETURNING *`,
      [name, relationship, isActive, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Traveler not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete traveler
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const owned = await query(`
      SELECT id FROM travelers
      WHERE id = $1 AND (created_by = $2 OR EXISTS (
        SELECT 1 FROM trip_travelers tt JOIN trips t ON t.id = tt.trip_id
        WHERE tt.traveler_id = travelers.id AND t.created_by = $2
      ))
    `, [id, req.user.id]);
    if (!owned.rows.length) return res.status(404).json({ error: 'Traveler not found' });
    await query('DELETE FROM trip_travelers WHERE traveler_id = $1 AND trip_id IN (SELECT id FROM trips WHERE created_by = $2)', [id, req.user.id]);
    const result = await query('DELETE FROM travelers WHERE id = $1 AND created_by = $2 RETURNING id', [id, req.user.id]);

    res.json({ message: result.rows.length ? 'Traveler deleted' : 'Traveler removed from your memories' });
  } catch (err) {
    next(err);
  }
});

export default router;
