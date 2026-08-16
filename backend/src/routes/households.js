import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../utils/db.js';

const router = Router();
const MAX_MEMBERS = 8;

async function currentHousehold(userId) {
  const result = await query(`
    SELECT h.id, h.slug, h.name, h.plan, hm.role
    FROM household_members hm JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = $1 ORDER BY h.id LIMIT 1
  `, [userId]);
  return result.rows[0] || null;
}

async function canManage(userId, householdId) {
  const result = await query('SELECT role FROM household_members WHERE user_id = $1 AND household_id = $2', [userId, householdId]);
  return ['owner', 'admin'].includes(result.rows[0]?.role) ? result.rows[0].role : null;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT h.id, h.slug, h.name, h.plan, hm.role,
        (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count
      FROM household_members hm JOIN households h ON h.id = hm.household_id
      WHERE hm.user_id = $1 ORDER BY h.id
    `, [req.user.id]);
    res.json({ households: result.rows, active_household_id: result.rows[0]?.id || null });
  } catch (err) { next(err); }
});

router.get('/current/members', async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    if (!household) return res.status(404).json({ error: 'Memory site not found.' });
    const [members, invitations] = await Promise.all([
      query(`SELECT u.id, u.email, u.display_name, hm.role, hm.created_at FROM household_members hm JOIN users u ON u.id = hm.user_id WHERE hm.household_id = $1 ORDER BY hm.created_at, u.id`, [household.id]),
      query(`SELECT id, email, role, expires_at, created_at FROM invitations WHERE household_id = $1 AND accepted_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC`, [household.id]),
    ]);
    res.json({ members: members.rows, invitations: invitations.rows, role: household.role, max_members: MAX_MEMBERS });
  } catch (err) { next(err); }
});

router.patch('/current', async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    const role = household && await canManage(req.user.id, household.id);
    if (!role) return res.status(403).json({ error: 'Only site owners and admins can rename this memory site.' });
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter a site name between 2 and 80 characters.' });
    const result = await query('UPDATE households SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, slug, name, plan', [name, household.id]);
    res.json({ household: { ...result.rows[0], role }, households: [result.rows[0]] });
  } catch (err) { next(err); }
});

router.post('/invitations', async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    const role = household && await canManage(req.user.id, household.id);
    if (!role) return res.status(403).json({ error: 'Only site owners and admins can invite people.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const count = await query('SELECT COUNT(*)::int AS count FROM household_members WHERE household_id = $1 UNION ALL SELECT COUNT(*)::int FROM invitations WHERE household_id = $1 AND accepted_at IS NULL AND expires_at > NOW()', [household.id]);
    const used = count.rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    if (used >= MAX_MEMBERS) return res.status(409).json({ error: `This memory site already has its ${MAX_MEMBERS}-person access limit.` });
    const existing = await query('SELECT 1 FROM household_members hm JOIN users u ON u.id = hm.user_id WHERE hm.household_id = $1 AND LOWER(u.email) = $2 UNION SELECT 1 FROM invitations WHERE household_id = $1 AND LOWER(email) = $2 AND accepted_at IS NULL', [household.id, email]);
    if (existing.rows.length) return res.status(409).json({ error: 'That person already has access or an invitation is pending.' });
    const invitation = await query('INSERT INTO invitations (id, household_id, email, role, invited_by, expires_at) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL \'7 days\') RETURNING id, email, role, expires_at', [crypto.randomUUID(), household.id, email, 'member', req.user.id]);
    res.status(201).json({ invitation: invitation.rows[0], message: `Invitation recorded for ${email}. Configure dev email delivery to send it automatically.` });
  } catch (err) { next(err); }
});

router.post('/invitations/:invitationId/resend', async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    const role = household && await canManage(req.user.id, household.id);
    if (!role) return res.status(403).json({ error: 'Only site owners and admins can resend invitations.' });
    const result = await query('UPDATE invitations SET expires_at = NOW() + INTERVAL \'7 days\', created_at = CURRENT_TIMESTAMP WHERE id = $1 AND household_id = $2 AND accepted_at IS NULL RETURNING email, expires_at', [req.params.invitationId, household.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'That invitation is no longer pending.' });
    res.json({ success: true, expires_at: result.rows[0].expires_at, message: `Invitation recorded again for ${result.rows[0].email}.` });
  } catch (err) { next(err); }
});

router.delete('/invitations/:invitationId', async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    const role = household && await canManage(req.user.id, household.id);
    if (!role) return res.status(403).json({ error: 'Only site owners and admins can cancel invitations.' });
    const result = await query('UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1 AND household_id = $2 AND accepted_at IS NULL RETURNING id', [req.params.invitationId, household.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'That invitation is no longer pending.' });
    res.json({ success: true, id: req.params.invitationId });
  } catch (err) { next(err); }
});

const memberPath = '/current/members/:userId';
router.patch(memberPath, async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    if (!household || household.role !== 'owner') return res.status(403).json({ error: 'Only the site owner can change member roles.' });
    const target = await query('SELECT role FROM household_members WHERE household_id = $1 AND user_id = $2', [household.id, req.params.userId]);
    if (!target.rows[0]) return res.status(404).json({ error: 'That person does not belong to this memory site.' });
    if (target.rows[0].role === 'owner') return res.status(400).json({ error: 'The site owner role cannot be changed.' });
    if (!['member', 'admin'].includes(req.body?.role)) return res.status(400).json({ error: 'Choose member or admin.' });
    await query('UPDATE household_members SET role = $1 WHERE household_id = $2 AND user_id = $3', [req.body.role, household.id, req.params.userId]);
    res.json({ success: true, role: req.body.role });
  } catch (err) { next(err); }
});

router.delete(memberPath, async (req, res, next) => {
  try {
    const household = await currentHousehold(req.user.id);
    if (!household || !['owner', 'admin'].includes(household.role)) return res.status(403).json({ error: 'Only site owners and admins can remove people.' });
    const target = await query('SELECT role FROM household_members WHERE household_id = $1 AND user_id = $2', [household.id, req.params.userId]);
    if (!target.rows[0]) return res.status(404).json({ error: 'That person does not belong to this memory site.' });
    if (target.rows[0].role === 'owner') return res.status(400).json({ error: 'The site owner cannot be removed.' });
    await query('DELETE FROM household_members WHERE household_id = $1 AND user_id = $2', [household.id, req.params.userId]);
    res.json({ success: true, user_id: Number(req.params.userId) });
  } catch (err) { next(err); }
});

export default router;
