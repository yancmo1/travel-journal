import { Router } from 'express';
import fs from 'fs/promises';
import { siteAdminMiddleware } from '../middleware/auth.js';
import { query } from '../utils/db.js';

const router = Router();
const statusPath = process.env.BACKUP_STATUS_PATH || '/app/maintenance/backup-status.json';
const staleAfterHours = Number(process.env.BACKUP_STALE_AFTER_HOURS || 30);

router.use(siteAdminMiddleware);

async function readBackupStatus() {
  try {
    const status = JSON.parse(await fs.readFile(statusPath, 'utf8'));
    const lastBackupMs = Date.parse(status.lastSuccessfulBackupAt || '');
    const ageHours = Number.isFinite(lastBackupMs)
      ? Math.max(0, (Date.now() - lastBackupMs) / (60 * 60 * 1000))
      : null;
    return {
      ...status,
      configured: true,
      stale: ageHours === null || ageHours > staleAfterHours,
      staleAfterHours,
      ageHours,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') throw error;
    return {
      configured: false,
      stale: true,
      staleAfterHours,
      ageHours: null,
      lastSuccessfulBackupAt: null,
      message: 'No successful backup has reported from the Ubuntu host yet.',
      checkedAt: new Date().toISOString(),
    };
  }
}

router.get('/operations', async (req, res, next) => {
  try {
    const [users, trips, photos] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM users'),
      query('SELECT COUNT(*)::int AS count FROM trips'),
      query('SELECT COUNT(*)::int AS count FROM photos'),
    ]);
    const bugReports = await query(`
      SELECT id, title, details, request_id, page, url, app_version, user_agent, screenshot_filename, screenshot_mime_type, (screenshot IS NOT NULL) AS has_screenshot, created_at
      FROM bug_reports
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({
      checkedAt: new Date().toISOString(),
      database: {
        status: 'connected',
        users: users.rows[0].count,
        trips: trips.rows[0].count,
        photos: photos.rows[0].count,
      },
      backup: await readBackupStatus(),
      observability: {
        grafanaUrl: process.env.GRAFANA_URL || null,
        prometheusUrl: process.env.PROMETHEUS_URL || null,
      },
      bugReports: bugReports.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
