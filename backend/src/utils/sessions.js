import crypto from 'crypto';
import { query } from './db.js';
import { isOperationsAdminEmail } from './admin.js';

export const SESSION_MAX_AGE_SECONDS = 7 * 86400;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sessionCookie(token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  return [
    `postcards_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    secure ? 'Secure' : '',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].filter(Boolean).join('; ');
}

export async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await query('DELETE FROM sessions WHERE expires_at <= NOW()');
  await query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
    [tokenHash, userId],
  );
  res.setHeader('Set-Cookie', sessionCookie(token));
}

export async function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie).postcards_session;
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
}

export async function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie).postcards_session;
  if (!token) return null;
  const result = await query(
    `SELECT u.id, u.email, u.display_name, u.site_admin
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()` ,
    [hashToken(token)],
  );
  return result.rows[0] ? { ...result.rows[0], site_admin: isOperationsAdminEmail(result.rows[0].email) } : null;
}
