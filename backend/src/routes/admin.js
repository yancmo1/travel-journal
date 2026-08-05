import { Router } from 'express';
import fs from 'fs/promises';
import { siteAdminMiddleware } from '../middleware/auth.js';
import { query } from '../utils/db.js';

const router = Router();
const statusPath = process.env.BACKUP_STATUS_PATH || '/app/maintenance/backup-status.json';
const staleAfterHours = Number(process.env.BACKUP_STALE_AFTER_HOURS || 30);
const GITHUB_LABEL = 'Bug Report';

function validBugReportId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function inlineFilename(value) {
  return String(value || 'screenshot').replace(/[\\"\r\n]/g, '_').slice(0, 160);
}

function githubRepository() {
  const value = String(process.env.GITHUB_REPOSITORY || 'yancmo1/travel-journal').trim();
  const match = value.match(/^([^/]+)\/([^/]+)$/);
  return match ? { owner: match[1], name: match[2] } : null;
}

function githubHeaders() {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'content-type': 'application/json',
    'user-agent': 'postcards-of-us',
    'x-github-api-version': '2022-11-28',
  };
}

async function githubJson(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function githubIssueBody(report) {
  return [
    'Submitted from the Postcards of Us Feedback inbox.',
    '',
    '## Details',
    report.details,
    '',
    '## Diagnostics',
    `- Report ID: \`${report.id}\``,
    `- Request reference: \`${report.request_id || 'Not available'}\``,
    `- Page: ${report.page || 'Not available'}`,
    `- URL: ${report.url || 'Not available'}`,
    `- App version: ${report.app_version || 'Not available'}`,
    `- Browser: ${report.user_agent || 'Not available'}`,
    `- Reported by user ID: \`${report.user_id || 'Not available'}\``,
    report.screenshot_filename ? `- Screenshot: ${report.screenshot_filename} (available in the private Operations inbox)` : '- Screenshot: None attached',
  ].join('\n');
}

router.use(siteAdminMiddleware);

router.get('/bug-reports/:reportId/screenshot', async (req, res, next) => {
  try {
    if (!validBugReportId(req.params.reportId)) return res.status(404).json({ error: 'Screenshot not found.' });
    const result = await query(`
      SELECT screenshot, screenshot_filename, screenshot_mime_type
      FROM bug_reports
      WHERE id = $1
      LIMIT 1
    `, [req.params.reportId]);
    const report = result.rows[0];
    if (!report?.screenshot) return res.status(404).json({ error: 'Screenshot not found.' });
    res.set({
      'Content-Type': report.screenshot_mime_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${inlineFilename(report.screenshot_filename)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(report.screenshot);
  } catch (error) {
    return next(error);
  }
});

router.delete('/bug-reports/:reportId', async (req, res, next) => {
  try {
    if (!validBugReportId(req.params.reportId)) return res.status(404).json({ error: 'Bug report not found.' });
    const result = await query('DELETE FROM bug_reports WHERE id = $1 RETURNING id', [req.params.reportId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Bug report not found.' });
    return res.json({ deleted: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
});

router.post('/bug-reports/:reportId/github-issue', async (req, res, next) => {
  try {
    if (!validBugReportId(req.params.reportId)) return res.status(404).json({ error: 'Bug report not found.' });
    if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'GitHub issue publishing is not configured.' });
    const repository = githubRepository();
    if (!repository) return res.status(503).json({ error: 'GitHub repository configuration is invalid.' });
    const result = await query(`
      SELECT id, user_id, title, details, request_id, page, url, app_version, user_agent, screenshot_filename, github_issue_id, github_issue_number, github_issue_url
      FROM bug_reports
      WHERE id = $1
      LIMIT 1
    `, [req.params.reportId]);
    const report = result.rows[0];
    if (!report) return res.status(404).json({ error: 'Bug report not found.' });
    if (report.github_issue_url) {
      return res.json({ githubIssue: { id: report.github_issue_id, number: report.github_issue_number, url: report.github_issue_url } });
    }

    const issue = await githubJson(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: `[Postcards] ${report.title}`,
        body: githubIssueBody(report),
        labels: [GITHUB_LABEL],
      }),
    });
    await query(`
      UPDATE bug_reports
      SET github_issue_id = $1, github_issue_number = $2, github_issue_url = $3, github_issue_created_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [issue.id, issue.number, issue.html_url, report.id]);
    return res.status(201).json({ githubIssue: { id: issue.id, number: issue.number, url: issue.html_url } });
  } catch (error) {
    return next(error);
  }
});

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
      SELECT id, title, details, request_id, page, url, app_version, user_agent, screenshot_filename, screenshot_mime_type, (screenshot IS NOT NULL) AS has_screenshot, github_issue_id, github_issue_number, github_issue_url, github_issue_created_at, created_at
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
