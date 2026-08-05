import jwt from 'jsonwebtoken';
import { query } from '../utils/db.js';
import { getSessionUser } from '../utils/sessions.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  try {
    const sessionUser = await getSessionUser(req);
    if (sessionUser) {
      req.user = sessionUser;
      return next();
    }
  } catch {
    return res.status(500).json({ error: 'Unable to verify your session.' });
  }

  // Compatibility for tokens issued before cookie sessions were enabled.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT id, email, display_name, site_admin FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
    req.user = { ...decoded, ...result.rows[0], site_admin: Boolean(result.rows[0].site_admin) };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

export function siteAdminMiddleware(req, res, next) {
  if (!req.user?.site_admin) return res.status(403).json({ error: 'Site administrator access required.' });
  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}
