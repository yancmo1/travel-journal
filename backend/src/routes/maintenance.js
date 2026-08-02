import { Router } from 'express';
import fs from 'fs/promises';
import { siteAdminMiddleware } from '../middleware/auth.js';

const router = Router();
const statusPath = process.env.BACKUP_STATUS_PATH || '/app/maintenance/backup-status.json';
const staleAfterHours = Number(process.env.BACKUP_STALE_AFTER_HOURS || 30);

router.use(siteAdminMiddleware);

router.get('/backup-status', async (req, res, next) => {
  try {
    let status;
    try {
      status = JSON.parse(await fs.readFile(statusPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') throw error;
      return res.json({
        configured: false,
        stale: true,
        staleAfterHours,
        message: 'No successful backup has reported from the Ubuntu host yet.',
      });
    }

    const lastBackupMs = Date.parse(status.lastSuccessfulBackupAt || '');
    const ageHours = Number.isFinite(lastBackupMs)
      ? Math.max(0, (Date.now() - lastBackupMs) / (60 * 60 * 1000))
      : null;

    res.json({
      configured: true,
      stale: ageHours === null || ageHours > staleAfterHours,
      staleAfterHours,
      ageHours,
      lastSuccessfulBackupAt: status.lastSuccessfulBackupAt || null,
      lastDatabaseDumpAt: status.lastDatabaseDumpAt || null,
      databaseDumpBytes: Number(status.databaseDumpBytes || 0),
      photoStorageBytes: Number(status.photoStorageBytes || 0),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
