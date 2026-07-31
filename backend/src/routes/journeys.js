import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../utils/db.js';

const router = Router();

export const journeySelect = `
  SELECT j.*,
    COALESCE((
      SELECT json_agg(memory_row ORDER BY memory_row.journey_order NULLS LAST, memory_row.start_date NULLS LAST, memory_row.id)
      FROM (
        SELECT t.*,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', p.id,
              'filename', p.filename,
              'file_path', p.file_path,
              'thumbnail_path', p.thumbnail_path,
              'date_taken', p.date_taken,
              'caption', p.caption,
              'sort_order', p.sort_order,
              'is_cover', p.is_cover,
              'rotation', p.rotation
            ) ORDER BY p.is_cover DESC, p.sort_order ASC, p.date_taken NULLS LAST, p.uploaded_at, p.id)
            FROM photos p
            WHERE p.trip_id = t.id
          ), '[]'::json) AS photos
        FROM trips t
        WHERE t.journey_id = j.id
      ) memory_row
    ), '[]'::json) AS memories
  FROM journeys j
`;

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`${journeySelect} ORDER BY j.start_date DESC NULLS LAST, j.id DESC`);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${journeySelect} WHERE j.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Journey not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

async function assignMemories(journeyId, memoryIds = []) {
  await query('UPDATE trips SET journey_id = NULL, journey_order = NULL WHERE journey_id = $1', [journeyId]);
  for (let index = 0; index < memoryIds.length; index += 1) {
    await query(
      'UPDATE trips SET journey_id = $1, journey_order = $2 WHERE id = $3',
      [journeyId, index + 1, memoryIds[index]]
    );
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { title, startDate, endDate, dateLabel, journeyType, summary, memoryIds = [], coverPhotoId = null } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Journey name is required' });

    const result = await query(`
      INSERT INTO journeys (title, start_date, end_date, date_label, journey_type, summary, cover_photo_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title.trim(), startDate || null, endDate || null, dateLabel || null,
      journeyType || 'Other', summary || null, coverPhotoId || null, req.user.id
    ]);

    await assignMemories(result.rows[0].id, memoryIds);
    const full = await query(`${journeySelect} WHERE j.id = $1`, [result.rows[0].id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { title, startDate, endDate, dateLabel, journeyType, summary, memoryIds = [], coverPhotoId = null } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Journey name is required' });

    const result = await query(`
      UPDATE journeys SET
        title = $1, start_date = $2, end_date = $3, date_label = $4,
        journey_type = $5, summary = $6, cover_photo_id = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id
    `, [
      title.trim(), startDate || null, endDate || null, dateLabel || null,
      journeyType || 'Other', summary || null, coverPhotoId || null, req.params.id
    ]);

    if (!result.rows.length) return res.status(404).json({ error: 'Journey not found' });
    await assignMemories(req.params.id, memoryIds);
    const full = await query(`${journeySelect} WHERE j.id = $1`, [req.params.id]);
    res.json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const token = crypto.randomBytes(32).toString('base64url');
    const result = await query(
      'UPDATE journeys SET share_token = $1, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, share_token, share_expires_at',
      [token, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Journey not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/share', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE journeys SET share_token = NULL, share_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Journey not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM journeys WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Journey not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;
