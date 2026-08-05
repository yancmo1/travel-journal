import { Router } from 'express';
import multer from 'multer';
import { query } from '../utils/db.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) return callback(null, true);
    return callback(new Error('Attach a PNG, JPG, or WebP screenshot.'));
  },
});

function uploadScreenshot(req, res, next) {
  upload.single('screenshot')(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Screenshots must be 5 MB or smaller.' });
    return res.status(400).json({ error: error.message || 'The screenshot could not be uploaded.' });
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function compact(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

async function sendBugReportNotification(report, user) {
  const recipient = compact(process.env.BUG_REPORT_TO, 254);
  if (!recipient || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;

  const subject = `[Postcards of Us] Bug report: ${compact(report.title, 120)}`;
  const text = [
    'A new Postcards of Us bug report was submitted.',
    '',
    `Title: ${report.title}`,
    `Details: ${report.details}`,
    '',
    `Request reference: ${report.request_id || 'Not available'}`,
    `Page: ${report.page || 'Not available'}`,
    `URL: ${report.url || 'Not available'}`,
    `App version: ${report.app_version || 'Not available'}`,
    `Reported by: ${user.email || user.display_name || `user ${user.id}`}`,
    `Browser: ${report.user_agent || 'Not available'}`,
    `Report ID: ${report.id}`,
  ].join('\n');
  const html = `<h2>New Postcards of Us bug report</h2><p><strong>Title:</strong> ${escapeHtml(report.title)}</p><p><strong>Details:</strong><br />${escapeHtml(report.details).replace(/\n/g, '<br />')}</p><hr /><p><strong>Request reference:</strong> ${escapeHtml(report.request_id || 'Not available')}<br /><strong>Page:</strong> ${escapeHtml(report.page || 'Not available')}<br /><strong>URL:</strong> ${escapeHtml(report.url || 'Not available')}<br /><strong>App version:</strong> ${escapeHtml(report.app_version || 'Not available')}<br /><strong>Reported by:</strong> ${escapeHtml(user.email || user.display_name || `user ${user.id}`)}<br /><strong>Browser:</strong> ${escapeHtml(report.user_agent || 'Not available')}<br /><strong>Report ID:</strong> ${escapeHtml(report.id)}</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      'idempotency-key': `bug-report-${report.id}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [recipient],
      subject,
      text,
      html,
      ...(report.screenshot ? {
        attachments: [{
          filename: report.screenshot_filename,
          content: report.screenshot.toString('base64'),
        }],
      } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Bug report email failed with status ${response.status}`);
}

router.post('/bugs', uploadScreenshot, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const details = String(req.body?.details || '').trim();
    if (!title || title.length > 120) return res.status(400).json({ error: 'Add a short bug title.' });
    if (!details || details.length > 4000) return res.status(400).json({ error: 'Add details in 4,000 characters or fewer.' });

    let context = req.body?.context;
    if (typeof context === 'string') {
      try { context = JSON.parse(context); } catch { context = {}; }
    }
    context = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
    const report = {
      id: crypto.randomUUID(),
      title,
      details,
      request_id: compact(context.requestId, 120) || null,
      page: compact(context.page, 200) || null,
      url: compact(context.url, 500) || null,
      app_version: compact(context.appVersion, 40) || null,
      user_agent: compact(context.userAgent || req.get('user-agent'), 500) || null,
      screenshot: req.file?.buffer || null,
      screenshot_filename: req.file?.originalname ? compact(req.file.originalname.replace(/[\\/]/g, '_'), 160) : null,
      screenshot_mime_type: req.file?.mimetype || null,
    };

    const stored = await query(`
      INSERT INTO bug_reports (id, user_id, title, details, request_id, page, url, app_version, user_agent, screenshot, screenshot_filename, screenshot_mime_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [report.id, req.user.id, report.title, report.details, report.request_id, report.page, report.url, report.app_version, report.user_agent, report.screenshot, report.screenshot_filename, report.screenshot_mime_type]);

    const savedReport = stored.rows[0];
    void sendBugReportNotification(savedReport, req.user).catch(error => {
      console.error('Bug report email failed:', error.message);
    });
    return res.status(201).json({ id: savedReport.id, message: 'Thanks — your report was saved.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
