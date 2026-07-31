import { Router } from 'express';
import { query } from '../utils/db.js';
import { journeySelect } from './journeys.js';

const router = Router();

router.get('/journeys/:token', async (req, res, next) => {
  try {
    const result = await query(
      `${journeySelect} WHERE j.share_token = $1 AND (j.share_expires_at IS NULL OR j.share_expires_at > CURRENT_TIMESTAMP)`,
      [req.params.token]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'This private journey link is no longer available.' });

    const { share_token: ignoredToken, share_expires_at: ignoredExpiry, ...journey } = result.rows[0];
    res.json(journey);
  } catch (err) {
    next(err);
  }
});

export default router;
