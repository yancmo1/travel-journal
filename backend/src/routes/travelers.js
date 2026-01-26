import { Router } from 'express';
import { query } from '../utils/db.js';

const router = Router();

// Get all travelers
router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM travelers ORDER BY created_at');
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
      'INSERT INTO travelers (name, relationship) VALUES ($1, $2) RETURNING *',
      [name, relationship || 'other']
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
      'UPDATE travelers SET name = COALESCE($1, name), relationship = COALESCE($2, relationship), is_active = COALESCE($3, is_active) WHERE id = $4 RETURNING *',
      [name, relationship, isActive, id]
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
    await query('DELETE FROM trip_travelers WHERE traveler_id = $1', [id]);
    const result = await query('DELETE FROM travelers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Traveler not found' });
    }

    res.json({ message: 'Traveler deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
