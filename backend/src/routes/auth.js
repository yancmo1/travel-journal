import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ensureUserHousehold, query } from '../utils/db.js';
import { createSession, destroySession, getSessionUser } from '../utils/sessions.js';
import { isOperationsAdmin } from '../utils/admin.js';
import { distanceFromHome } from '../utils/calculations.js';

const router = Router();
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      return res.status(403).json({ error: 'Postcards of Us is currently invitation-only.' });
    }

    const email = normalizeEmail(req.body.email);
    const { password, displayName } = req.body;
    
    if (!validEmail(email) || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters.' });
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, site_admin',
      [email, email, passwordHash, displayName || email]
    );

    const user = result.rows[0];
    await ensureUserHousehold(user.id, user.display_name);
    await createSession(user.id, res);
    const households = await query('SELECT h.id, h.slug, h.name, h.plan, hm.role, (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count FROM household_members hm JOIN households h ON h.id = hm.household_id WHERE hm.user_id = $1 ORDER BY h.id', [user.id]);
    res.json({ user: { ...user, site_admin: isOperationsAdmin(user) }, households: households.rows, active_household_id: households.rows[0]?.id || null });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    
    if (!validEmail(email) || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await query(
      'SELECT id, email, password_hash, display_name, site_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await ensureUserHousehold(user.id, user.display_name);
    await createSession(user.id, res);
    const households = await query('SELECT h.id, h.slug, h.name, h.plan, hm.role, (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count FROM household_members hm JOIN households h ON h.id = hm.household_id WHERE hm.user_id = $1 ORDER BY h.id', [user.id]);
    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name, site_admin: isOperationsAdmin(user) },
      households: households.rows,
      active_household_id: households.rows[0]?.id || null,
    });
  } catch (err) {
    next(err);
  }
});

// Verify token / get current user
async function resolveCurrentUser(req) {
  const sessionUser = await getSessionUser(req);
  if (sessionUser) return sessionUser;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const result = await query(
    'SELECT id, email, display_name, site_admin, home_latitude, home_longitude, home_label, home_icon FROM users WHERE id = $1',
    [decoded.id]
  );

  if (result.rows.length === 0) return null;
  return { ...result.rows[0], site_admin: isOperationsAdmin(result.rows[0]) };
}

const HOME_ICONS = ['h', 'house', 'cabin', 'cottage'];

router.get('/me', async (req, res, next) => {
  try {
    const sessionUser = await resolveCurrentUser(req);
    if (sessionUser) {
      await ensureUserHousehold(sessionUser.id, sessionUser.display_name);
      const households = await query(`SELECT h.id, h.slug, h.name, h.plan, hm.role, (SELECT COUNT(*) FROM household_members members WHERE members.household_id = h.id) AS member_count FROM household_members hm JOIN households h ON h.id = hm.household_id WHERE hm.user_id = $1 ORDER BY h.id`, [sessionUser.id]);
      return res.json({ user: sessionUser, households: households.rows, active_household_id: households.rows[0]?.id || null });
    }
    return res.status(401).json({ error: 'No token' });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
});

// Save the user's home base (used for the map's home marker and distance-from-home).
router.patch('/me', async (req, res, next) => {
  try {
    const user = await resolveCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in required' });

    const { homeLatitude, homeLongitude, homeLabel, homeIcon } = req.body || {};

    const latitude = homeLatitude === null || homeLatitude === undefined || String(homeLatitude).trim() === ''
      ? null
      : Number(homeLatitude);
    const longitude = homeLongitude === null || homeLongitude === undefined || String(homeLongitude).trim() === ''
      ? null
      : Number(homeLongitude);

    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
      return res.status(400).json({ error: 'Home latitude is invalid.' });
    }
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
      return res.status(400).json({ error: 'Home longitude is invalid.' });
    }
    if ((latitude === null) !== (longitude === null)) {
      return res.status(400).json({ error: 'Home needs both a latitude and a longitude.' });
    }

    const label = homeLabel === null || homeLabel === undefined ? null : String(homeLabel).trim().slice(0, 255) || null;
    const icon = HOME_ICONS.includes(homeIcon) ? homeIcon : 'h';

    const result = await query(
      `UPDATE users
       SET home_latitude = $1, home_longitude = $2, home_label = $3, home_icon = $4
       WHERE id = $5
       RETURNING id, email, display_name, site_admin, home_latitude, home_longitude, home_label, home_icon`,
      [latitude, longitude, label, icon, user.id]
    );

    const trips = await query('SELECT id, latitude, longitude FROM trips WHERE created_by = $1', [user.id]);
    await Promise.all(trips.rows.map(trip => query(
      'UPDATE trips SET home_distance_miles = $1, updated_at = NOW() WHERE id = $2 AND created_by = $3',
      [trip.latitude != null && trip.longitude != null && latitude != null && longitude != null
        ? distanceFromHome(trip.latitude, trip.longitude, { home_latitude: latitude, home_longitude: longitude })
        : null, trip.id, user.id],
    )));

    res.json({ user: { ...result.rows[0], site_admin: isOperationsAdmin(result.rows[0]) } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function sendPasswordResetEmail(email, resetUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;

  const subject = 'Reset your Postcards of Us password';
  const text = [
    'Hi,',
    '',
    'We received a request to reset the password for your Postcards of Us account.',
    '',
    `Open this link to choose a new password (valid for 1 hour):`,
    resetUrl,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    '— Postcards of Us',
  ].join('\n');
  const safeUrl = String(resetUrl).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  const html = `<p>Hi,</p><p>We received a request to reset the password for your Postcards of Us account.</p><p><a href="${safeUrl}">Reset your password</a> (link valid for 1 hour)</p><p>If you did not request a password reset, you can safely ignore this email.</p><p>— Postcards of Us</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `******
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject, text, html }),
  });
  if (!response.ok) throw new Error(`Password reset email failed with status ${response.status}`);
}

// Request password reset
router.post('/forgot-password', async (req, res, next) => {
  const GENERIC_MESSAGE = 'If an account with that email exists, a reset link has been sent.';
  try {
    const email = normalizeEmail(req.body.email);
    if (!validEmail(email)) return res.json({ message: GENERIC_MESSAGE });

    const result = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.json({ message: GENERIC_MESSAGE });

    const userId = result.rows[0].id;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString()],
    );

    const appUrl = String(process.env.APP_URL || 'https://postcardsofus.com').replace(/\/$/, '');
    const resetUrl = `${appUrl}/?reset=${rawToken}`;
    await sendPasswordResetEmail(email, resetUrl);

    return res.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    next(err);
  }
});

// Complete password reset
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (typeof password !== 'string' || password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters.' });
    }
    if (password.length > 128) return res.status(400).json({ error: 'Password must be 128 characters or fewer.' });

    const tokenHash = hashToken(String(token));
    const result = await query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    const { id: tokenId, user_id: userId } = result.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);

    return res.json({ message: 'Your password has been updated. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

export default router;
