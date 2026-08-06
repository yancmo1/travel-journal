import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db.js';
import { createSession, destroySession, getSessionUser } from '../utils/sessions.js';
import { isOperationsAdmin } from '../utils/admin.js';

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

    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters.' });
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
    await createSession(user.id, res);
    res.json({ user: { ...user, site_admin: isOperationsAdmin(user) } });
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

    await createSession(user.id, res);
    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name, site_admin: isOperationsAdmin(user) },
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
    if (sessionUser) return res.json({ user: sessionUser });
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

export default router;
