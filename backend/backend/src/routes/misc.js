/**
 * Misc public and optional protected routes under /api/misc.
 * Locations, roles, categories, adverts (banner), report-error.
 */
const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/locations', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT location_id, location_name, currency_id, location_lat, location_long, location_radius FROM location ORDER BY location_name'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Client roles (Basic, Silver, Diamond, Admin) with optional plan_description/plan_features. */
router.get('/roles', async (req, res) => {
  try {
    let r;
    try {
      r = await pool.query(
        'SELECT client_role_id, client_role, sub_price, listing_priority, plan_description, plan_features FROM client_role ORDER BY listing_priority'
      );
    } catch (colErr) {
      // Deployed DB may not have plan_description/plan_features yet; run migrations/run-plan-description-features.js
      if (/column.*does not exist/i.test(colErr.message)) {
        r = await pool.query(
          'SELECT client_role_id, client_role, sub_price, listing_priority FROM client_role ORDER BY listing_priority'
        );
        r.rows = r.rows.map((row) => ({ ...row, plan_description: null, plan_features: [] }));
      } else {
        throw colErr;
      }
    }
    const rows = r.rows.map((row) => {
      const out = { ...row };
      if (out.plan_features != null && typeof out.plan_features === 'string') {
        try {
          out.plan_features = JSON.parse(out.plan_features);
        } catch (_) {
          out.plan_features = out.plan_features ? out.plan_features.split('\n').filter(Boolean) : [];
        }
      }
      if (!Array.isArray(out.plan_features)) out.plan_features = [];
      return out;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Product categories for listing form dropdown. */
router.get('/categories', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT category_id, category_name FROM product_category ORDER BY category_name'
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Active banner adverts (Diamond services) for rotating ad bar. */
router.get('/adverts', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.advert_list_id, a.service_id, a.service_clicks,
              s.service_name, s.service_description, s.service_logo_path
       FROM advert_list a
       JOIN service s ON s.service_id = a.service_id
       WHERE a.active = TRUE
       ORDER BY a.advert_list_id`
    );
    res.json(r.rows.map((row) => ({
      id: row.advert_list_id,
      service_id: row.service_id,
      name: row.service_name,
      text: row.service_description || '',
      logo: row.service_logo_path || null,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Submit error report; notifies admins via messages. */
router.post('/report-error', verifyToken, async (req, res) => {
  try {
    const { subject, description, screenshot_path } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    let reportRes;
    try {
      reportRes = await pool.query(
        `INSERT INTO error_report (client_id, subject, description, screenshot_path)
         VALUES ($1, $2, $3, $4) RETURNING report_id`,
        [req.user.client_id, subject || null, description, screenshot_path || null]
      );
    } catch (colErr) {
      if (/column.*screenshot_path.*does not exist/i.test(colErr.message)) {
        reportRes = await pool.query(
          `INSERT INTO error_report (client_id, subject, description)
           VALUES ($1, $2, $3) RETURNING report_id`,
          [req.user.client_id, subject || null, description]
        );
      } else {
        throw colErr;
      }
    }
    const reportId = reportRes.rows[0]?.report_id;
    const reporter = await pool.query('SELECT username FROM client WHERE client_id = $1', [req.user.client_id]);
    const reporterName = reporter.rows[0]?.username || 'A user';
    const snippet = String(description).trim().slice(0, 120) + (description.length > 120 ? '…' : '');
    const body = `New issue reported by @${reporterName}${subject ? `: ${subject}` : ''}. ${snippet} — Check Admin → Tables → error_report.`;
    const admins = await pool.query('SELECT client_id FROM client WHERE is_admin = TRUE AND active = TRUE');
    for (const row of admins.rows) {
      if (row.client_id !== req.user.client_id) {
        await pool.query(
          'INSERT INTO message (sender_id, recipient_id, body) VALUES ($1, $2, $3)',
          [req.user.client_id, row.client_id, body]
        );
      }
    }
    res.status(201).json({ message: 'Report submitted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
