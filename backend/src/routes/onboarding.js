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
    const [progress, user, memoryCount, journeyCount, peopleCount] = await Promise.all([
      query('SELECT home_skipped, people_skipped, memory_id, journey_id, welcome_seen, refresher_hidden, completed_at FROM onboarding_progress WHERE household_id = $1 AND user_id = $2', [householdId, req.user.id]),
      query('SELECT home_latitude, home_longitude FROM users WHERE id = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM trips WHERE created_by = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM journeys WHERE created_by = $1', [req.user.id]),
      query(`SELECT COUNT(*)::int AS count FROM travelers tr WHERE tr.created_by = $1 OR EXISTS (
        SELECT 1 FROM trip_travelers tt JOIN trips owned_trip ON owned_trip.id = tt.trip_id
        WHERE tt.traveler_id = tr.id AND owned_trip.created_by = $1
      )`, [req.user.id]),
    ]);
    const row = progress.rows[0] || {};
    const homeComplete = user.rows[0]?.home_latitude != null && user.rows[0]?.home_longitude != null;
    const memoryComplete = Number(memoryCount.rows[0]?.count || 0) > 0;
    const journeyComplete = Number(journeyCount.rows[0]?.count || 0) > 0;
    const peopleComplete = Number(peopleCount.rows[0]?.count || 0) > 0;
    res.json({ home: { complete: homeComplete, skipped: Boolean(row.home_skipped) && !homeComplete }, people: { complete: peopleComplete, skipped: Boolean(row.people_skipped) && !peopleComplete }, memory: { complete: memoryComplete, id: row.memory_id || null }, journey: { complete: journeyComplete, id: row.journey_id || null }, welcomeSeen: Boolean(row.welcome_seen), refresherHidden: Boolean(row.refresher_hidden), completed: (Boolean(row.completed_at) && peopleComplete) || (homeComplete && peopleComplete && memoryComplete && journeyComplete) });
  } catch (err) { next(err); }
});

router.patch('/', async (req, res, next) => {
  try {
    const householdId = await householdFor(req.user.id);
    const step = String(req.body?.step || '').trim();
    if (!householdId || !['welcome', 'home', 'people', 'memory', 'journey', 'refresher'].includes(step)) return res.status(400).json({ error: 'Choose a valid onboarding step.' });
    const homeSkipped = step === 'home' && req.body?.status === 'skipped';
    const peopleSkipped = step === 'people' && req.body?.status === 'skipped';
    const memoryId = step === 'memory' && Number.isInteger(Number(req.body?.memoryId)) ? Number(req.body.memoryId) : null;
    const journeyId = step === 'journey' && Number.isInteger(Number(req.body?.journeyId)) ? Number(req.body.journeyId) : null;
    const refresherHidden = step === 'refresher' && req.body?.status === 'hidden';
    const [user, memoryCount, journeyCount, peopleCount] = await Promise.all([
      query('SELECT home_latitude, home_longitude FROM users WHERE id = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM trips WHERE created_by = $1', [req.user.id]),
      query('SELECT COUNT(*)::int AS count FROM journeys WHERE created_by = $1', [req.user.id]),
      query(`SELECT COUNT(*)::int AS count FROM travelers tr WHERE tr.created_by = $1 OR EXISTS (
        SELECT 1 FROM trip_travelers tt JOIN trips owned_trip ON owned_trip.id = tt.trip_id
        WHERE tt.traveler_id = tr.id AND owned_trip.created_by = $1
      )`, [req.user.id]),
    ]);
    const onboardingReady = user.rows[0]?.home_latitude != null && user.rows[0]?.home_longitude != null
      && Number(memoryCount.rows[0]?.count || 0) > 0 && Number(journeyCount.rows[0]?.count || 0) > 0
      && Number(peopleCount.rows[0]?.count || 0) > 0;
    await query(`
      INSERT INTO onboarding_progress (household_id, user_id, home_skipped, people_skipped, memory_id, journey_id, welcome_seen, refresher_hidden, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (household_id, user_id) DO UPDATE SET
        home_skipped = CASE WHEN $3 THEN TRUE WHEN $9 = 'home' THEN FALSE ELSE onboarding_progress.home_skipped END,
        people_skipped = CASE WHEN $4 THEN TRUE WHEN $9 = 'people' THEN FALSE ELSE onboarding_progress.people_skipped END,
        memory_id = COALESCE($5, onboarding_progress.memory_id),
        journey_id = COALESCE($6, onboarding_progress.journey_id),
        welcome_seen = onboarding_progress.welcome_seen OR $7,
        refresher_hidden = onboarding_progress.refresher_hidden OR $8,
        completed_at = CASE WHEN $9 = 'journey' AND $6 IS NOT NULL AND $10 THEN CURRENT_TIMESTAMP WHEN NOT $10 THEN NULL ELSE onboarding_progress.completed_at END,
        updated_at = CURRENT_TIMESTAMP
    `, [householdId, req.user.id, homeSkipped, peopleSkipped, memoryId, journeyId, step === 'welcome', refresherHidden, step, onboardingReady]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
