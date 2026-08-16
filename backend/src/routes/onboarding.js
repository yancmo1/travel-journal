import { Router } from 'express';
import { query } from '../utils/db.js';

const router = Router();

async function householdFor(userId) {
  const result = await query('SELECT household_id FROM household_members WHERE user_id = $1 ORDER BY household_id LIMIT 1', [userId]);
  return result.rows[0]?.household_id || null;
}

router.get('/', async (req, res, next) => {
  try {
    const householdId = await householdFor(req.user.id);
    if (!householdId) return res.status(404).json({ error: 'Memory site not found.' });
    const [progress, user, memoryCount, journeyCount] = await Promise.all([
      query('SELECT home_skipped, memory_id, journey_id, welcome_seen, completed_at FROM onboarding_progress WHERE household_id = $1 AND user_id = $2', [householdId, req.user.id]),
      query('SELECT home_latitude, home_longitude FROM users WHERE id = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM trips WHERE created_by = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM journeys WHERE created_by = $1', [req.user.id]),
    ]);
    const row = progress.rows[0] || {};
    const homeComplete = user.rows[0]?.home_latitude != null && user.rows[0]?.home_longitude != null;
    const memoryComplete = Number(memoryCount.rows[0]?.count || 0) > 0;
    const journeyComplete = Number(journeyCount.rows[0]?.count || 0) > 0;
    res.json({ home: { complete: homeComplete, skipped: Boolean(row.home_skipped) && !homeComplete }, memory: { complete: memoryComplete, id: row.memory_id || null }, journey: { complete: journeyComplete, id: row.journey_id || null }, welcomeSeen: Boolean(row.welcome_seen), completed: Boolean(row.completed_at) || (homeComplete && memoryComplete && journeyComplete) });
  } catch (err) { next(err); }
});

router.patch('/', async (req, res, next) => {
  try {
    const householdId = await householdFor(req.user.id);
    const step = String(req.body?.step || '').trim();
    if (!householdId || !['welcome', 'home', 'memory', 'journey'].includes(step)) return res.status(400).json({ error: 'Choose a valid onboarding step.' });
    const homeSkipped = step === 'home' && req.body?.status === 'skipped';
    const memoryId = step === 'memory' && Number.isInteger(Number(req.body?.memoryId)) ? Number(req.body.memoryId) : null;
    const journeyId = step === 'journey' && Number.isInteger(Number(req.body?.journeyId)) ? Number(req.body.journeyId) : null;
    await query(`
      INSERT INTO onboarding_progress (household_id, user_id, home_skipped, memory_id, journey_id, welcome_seen, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (household_id, user_id) DO UPDATE SET
        home_skipped = CASE WHEN $3 THEN TRUE WHEN $7 = 'home' THEN FALSE ELSE onboarding_progress.home_skipped END,
        memory_id = COALESCE($4, onboarding_progress.memory_id),
        journey_id = COALESCE($5, onboarding_progress.journey_id),
        welcome_seen = onboarding_progress.welcome_seen OR $6,
        completed_at = CASE WHEN $7 = 'journey' AND $5 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE onboarding_progress.completed_at END,
        updated_at = CURRENT_TIMESTAMP
    `, [householdId, req.user.id, homeSkipped, memoryId, journeyId, step === 'welcome', step]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
