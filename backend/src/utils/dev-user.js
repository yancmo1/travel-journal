import bcrypt from 'bcryptjs';
import { query } from './db.js';

export async function ensureDevelopmentUser() {
  if (process.env.NODE_ENV !== 'development') return;

  const email = String(process.env.DEV_USER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.DEV_USER_PASSWORD || '');

  if (!email && !password) return;
  if (!email || !password) {
    throw new Error('DEV_USER_EMAIL and DEV_USER_PASSWORD must be provided together');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('DEV_USER_EMAIL must be a valid email address');
  }
  if (password.length < 10) {
    throw new Error('DEV_USER_PASSWORD must be at least 10 characters');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = String(process.env.DEV_USER_DISPLAY_NAME || email).trim();

  await query(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, $1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name`,
    [email, passwordHash, displayName || email],
  );

  console.log(`Development login ready for ${email}`);
}
