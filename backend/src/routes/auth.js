import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db.js';

const router = Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

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
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    res.json({ user, token });
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

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    res.json({
      user: { id: user.id, email: user.email, display_name: user.display_name, site_admin: Boolean(user.site_admin) },
      token
    });
  } catch (err) {
    next(err);
  }
});

// Verify token / get current user
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(
      'SELECT id, email, display_name, site_admin FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: { ...result.rows[0], site_admin: Boolean(result.rows[0].site_admin) } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(err);
  }
});

export default router;
