const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getPaymentConfig, setPaymentConfig } = require('../lib/payment-config');
const { applySubscriptionRulesForClient } = require('../lib/subscription-rules');
const { verifyTransport, sendEmail, isMailgunConfigured, isSmtpConfigured } = require('../lib/email');

const router = express.Router();
router.use(verifyToken, requireAdmin);

const TABLE_WHITELIST = [
  'currency', 'location', 'client_role', 'client', 'product_category', 'product',
  'product_listing', 'service', 'service_listing', 'advert_list', 'error_report',
];

function getPkCol(table) {
  const map = {
    product_listing: 'listing_id', service_listing: 'service_listing_id',
    advert_list: 'advert_list_id', error_report: 'report_id',
    product_category: 'category_id',
  };
  return map[table] || `${table.replace(/s$/, '')}_id`;
}

/** Test email config; returns { ok: true } or { ok: false, error: string }. Works for Mailgun or SMTP. */
router.get('/test-email', async (req, res) => {
  try {
    const result = await verifyTransport();
    if (result.ok) {
      const provider = isMailgunConfigured() ? 'Mailgun' : 'SMTP';
      return res.json({ ok: true, message: `${provider} configured successfully` });
    }
    return res.status(503).json({ ok: false, error: result.error });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/** Send a test email to the given address (admin only). Body: { to: "email@example.com" }. Uses Mailgun or SMTP. */
router.post('/send-test-email', async (req, res) => {
  try {
    const to = (req.body?.to || '').trim();
    if (!to) return res.status(400).json({ error: 'Body must include "to" email address' });
    if (!isMailgunConfigured() && !isSmtpConfigured()) {
      return res.status(503).json({ error: 'Email not configured (set MAILGUN_API_KEY + MAILGUN_DOMAIN or SMTP_HOST)' });
    }
    const subject = 'Mmaraka – Test email';
    const text = 'This is a test email from your Mmaraka server. If you received this, email is working.';
    const html = '<p>This is a test email from your Mmaraka server. If you received this, email is working.</p>';
    await sendEmail(to, subject, text, html);
    return res.json({ ok: true, message: 'Test email sent' });
  } catch (e) {
    const msg = e.message || e.response || String(e);
    return res.status(503).json({ ok: false, error: msg });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const [clients, clientsWeek, products, productsWeek, services, servicesWeek, reports] = await Promise.all([
      pool.query('SELECT COUNT(*) AS n FROM client'),
      pool.query('SELECT COUNT(*) AS n FROM client WHERE created_at >= $1', [weekStart]),
      pool.query('SELECT COUNT(*) AS n FROM product_listing'),
      pool.query('SELECT COUNT(*) AS n FROM product_listing WHERE created_at >= $1', [weekStart]),
      pool.query('SELECT COUNT(*) AS n FROM service'),
      pool.query('SELECT COUNT(*) AS n FROM service WHERE created_at >= $1', [weekStart]),
      pool.query('SELECT COUNT(*) AS n FROM error_report WHERE resolved = FALSE'),
    ]);
    res.json({
      clients: parseInt(clients.rows[0].n, 10),
      clients_this_week: parseInt(clientsWeek.rows[0].n, 10),
      product_listings: parseInt(products.rows[0].n, 10),
      product_listings_this_week: parseInt(productsWeek.rows[0].n, 10),
      services: parseInt(services.rows[0].n, 10),
      services_this_week: parseInt(servicesWeek.rows[0].n, 10),
      unresolved_reports: parseInt(reports.rows[0].n, 10),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dashboard/activity', async (req, res) => {
  try {
    const [productListings, serviceListings, subscriptionOrders, paypalSubs, errorReports] = await Promise.all([
      pool.query(
        `SELECT c.username, p.product_name, pl.created_at AS ts
         FROM product_listing pl
         JOIN client c ON pl.client_id = c.client_id
         JOIN product p ON pl.product_id = p.product_id
         ORDER BY pl.created_at DESC LIMIT 15`
      ),
      pool.query(
        `SELECT c.username, s.service_name, sl.created_at AS ts
         FROM service_listing sl
         JOIN service s ON sl.service_id = s.service_id
         JOIN client c ON s.client_id = c.client_id
         ORDER BY sl.created_at DESC LIMIT 15`
      ),
      pool.query(
        `SELECT c.username, cr.client_role, so.created_at AS ts
         FROM subscription_order so
         JOIN client c ON so.client_id = c.client_id
         JOIN client_role cr ON cr.client_role_id = so.client_role_id
         WHERE so.status = 'completed'
         ORDER BY so.created_at DESC LIMIT 15`
      ),
      pool.query(
        `SELECT c.username, cr.client_role, ps.created_at AS ts
         FROM paypal_subscription ps
         JOIN client c ON ps.client_id = c.client_id
         JOIN client_role cr ON ps.client_role_id = cr.client_role_id
         ORDER BY ps.created_at DESC LIMIT 15`
      ),
      pool.query(
        `SELECT c.username, er.submitted_at AS ts
         FROM error_report er
         LEFT JOIN client c ON er.client_id = c.client_id
         ORDER BY er.submitted_at DESC LIMIT 15`
      ),
    ]);

    const mapRow = (user, action, ts) => ({ user: user || '—', action, time: ts });
    const items = [
      ...productListings.rows.map((r) => mapRow(r.username, `Listed ${r.product_name || 'product'}`, r.ts)),
      ...serviceListings.rows.map((r) => mapRow(r.username, `Listed service ${r.service_name || 'service'}`, r.ts)),
      ...subscriptionOrders.rows.map((r) => mapRow(r.username, `Subscribed to ${r.client_role || 'plan'}`, r.ts)),
      ...paypalSubs.rows.map((r) => mapRow(r.username, `Subscribed to ${r.client_role || 'plan'} (recurring)`, r.ts)),
      ...errorReports.rows.map((r) => mapRow(r.username, 'Reported an error', r.ts)),
    ];

    items.sort((a, b) => new Date(b.time) - new Date(a.time));
    const activity = items.slice(0, 20).map(({ user, action, time }) => ({
      user,
      action,
      time: new Date(time).toISOString(),
    }));

    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/clients', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, c.active, c.join_date, cr.client_role
       FROM client c
       JOIN client_role cr ON c.client_role_id = cr.client_role_id
       ORDER BY c.join_date DESC`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client ID' });
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, c.active, c.client_role_id, c.first_name, c.last_name,
              c.whatsapp, c.country_code, c.location_id, c.join_date
       FROM client c
       WHERE c.client_id = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/clients/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client ID' });
    const {
      username,
      email,
      active,
      client_role_id,
      first_name,
      last_name,
      whatsapp,
      country_code,
      location_id,
    } = req.body || {};
    const updates = [];
    const values = [];
    let i = 1;
    if (username !== undefined) {
      updates.push(`username = $${i++}`);
      values.push(String(username).trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${i++}`);
      values.push(String(email).trim());
    }
    if (active !== undefined) {
      updates.push(`active = $${i++}`);
      values.push(active === true || active === 'true');
    }
    if (client_role_id !== undefined) {
      const roleId = parseInt(client_role_id, 10);
      if (!Number.isFinite(roleId)) return res.status(400).json({ error: 'Invalid client_role_id' });
      updates.push(`client_role_id = $${i++}`);
      values.push(roleId);
    }
    if (first_name !== undefined) {
      updates.push(`first_name = $${i++}`);
      values.push(first_name === '' || first_name == null ? null : String(first_name).trim());
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${i++}`);
      values.push(last_name === '' || last_name == null ? null : String(last_name).trim());
    }
    if (whatsapp !== undefined) {
      updates.push(`whatsapp = $${i++}`);
      values.push(whatsapp === '' || whatsapp == null ? null : String(whatsapp).trim().replace(/\D/g, ''));
    }
    if (country_code !== undefined) {
      updates.push(`country_code = $${i++}`);
      values.push(country_code === '' || country_code == null ? null : String(country_code).trim());
    }
    if (location_id !== undefined) {
      updates.push(`location_id = $${i++}`);
      values.push(location_id === '' || location_id == null ? null : parseInt(location_id, 10));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    await pool.query(
      `UPDATE client SET ${updates.join(', ')}, updated_at = NOW() WHERE client_id = $${i}`,
      values
    );
    if (client_role_id !== undefined) {
      const newRoleId = parseInt(client_role_id, 10);
      if (Number.isFinite(newRoleId)) {
        await applySubscriptionRulesForClient(id, newRoleId).catch((err) => console.error('[admin PUT /clients/:id] applySubscriptionRulesForClient:', err.message));
      }
    }
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, c.active, c.client_role_id, c.first_name, c.last_name,
              c.whatsapp, c.country_code, c.location_id, c.join_date
       FROM client c WHERE c.client_id = $1`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username or email already in use' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/payment-config', async (req, res) => {
  try {
    const config = await getPaymentConfig();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/payment-config', async (req, res) => {
  try {
    const { paypal_client_id, paypal_client_secret, paypal_sandbox, paypal_plan_id_Silver, paypal_plan_id_Diamond, currency_code, paypal_webhook_id } = req.body || {};
    await setPaymentConfig({
      paypal_client_id,
      paypal_client_secret,
      paypal_sandbox: paypal_sandbox === true || paypal_sandbox === 'true',
      paypal_plan_id_Silver,
      paypal_plan_id_Diamond,
      currency_code,
      paypal_webhook_id,
    });
    const config = await getPaymentConfig();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/plans', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT client_role_id, client_role, sub_price, listing_priority, plan_description, plan_features FROM client_role ORDER BY listing_priority'
    );
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

router.put('/plans/prices', async (req, res) => {
  try {
    const { prices } = req.body || {};
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices array required' });
    for (const item of prices) {
      const id = parseInt(item.client_role_id, 10);
      if (!Number.isFinite(id)) continue;
      const updates = [];
      const values = [];
      let idx = 1;
      if (typeof item.sub_price === 'number' || (typeof item.sub_price === 'string' && item.sub_price !== '')) {
        const subPrice = parseFloat(item.sub_price);
        if (Number.isFinite(subPrice) && subPrice >= 0) {
          updates.push(`sub_price = $${idx++}`);
          values.push(subPrice);
        }
      }
      if (item.plan_description !== undefined) {
        updates.push(`plan_description = $${idx++}`);
        values.push(item.plan_description == null ? null : String(item.plan_description).trim() || null);
      }
      if (item.plan_features !== undefined) {
        const arr = Array.isArray(item.plan_features) ? item.plan_features : (typeof item.plan_features === 'string' ? item.plan_features.split('\n').map(s => s.trim()).filter(Boolean) : []);
        updates.push(`plan_features = $${idx++}`);
        values.push(arr.length ? JSON.stringify(arr) : null);
      }
      if (updates.length === 0) continue;
      values.push(id);
      await pool.query(
        `UPDATE client_role SET ${updates.join(', ')} WHERE client_role_id = $${idx}`,
        values
      );
    }
    const r = await pool.query(
      'SELECT client_role_id, client_role, sub_price, listing_priority, plan_description, plan_features FROM client_role ORDER BY listing_priority'
    );
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

router.get('/tables', (req, res) => {
  res.json(TABLE_WHITELIST);
});

// Error reports list (with reporter username) for admin panel
router.get('/reports', async (req, res) => {
  try {
    let r;
    try {
      r = await pool.query(
        `SELECT er.report_id, er.client_id, er.subject, er.description, er.screenshot_path, er.resolved, er.submitted_at,
                c.username AS reporter_username
         FROM error_report er
         LEFT JOIN client c ON er.client_id = c.client_id
         ORDER BY er.submitted_at DESC`
      );
    } catch (colErr) {
      if (/column.*screenshot_path.*does not exist/i.test(colErr.message)) {
        r = await pool.query(
          `SELECT er.report_id, er.client_id, er.subject, er.description, er.resolved, er.submitted_at,
                  c.username AS reporter_username
           FROM error_report er
           LEFT JOIN client c ON er.client_id = c.client_id
           ORDER BY er.submitted_at DESC`
        );
        r.rows = r.rows.map((row) => ({ ...row, screenshot_path: null }));
      } else {
        throw colErr;
      }
    }
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/reports/:id/resolved', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const r = await pool.query(
      'UPDATE error_report SET resolved = TRUE WHERE report_id = $1 RETURNING *',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid report ID' });
    const r = await pool.query('DELETE FROM error_report WHERE report_id = $1 RETURNING *', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json({ deleted: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tables/:table', async (req, res) => {
  const table = req.params.table;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  try {
    const r = await pool.query(`SELECT * FROM ${table} LIMIT 500`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Schema for a table (column names and auto-generated flags) for "Add record" form
router.get('/tables/:table/schema', async (req, res) => {
  const table = req.params.table;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  try {
    const r = await pool.query(
      `SELECT column_name, data_type, column_default, is_generated
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    res.json(r.rows.map((row) => {
      const def = row.column_default ? String(row.column_default) : '';
      const auto = !!(def.includes('nextval') || def.includes('generated') || row.is_generated === 'ALWAYS');
      return {
        name: row.column_name,
        type: row.data_type,
        default: row.column_default,
        auto,
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tables/:table', async (req, res) => {
  const table = req.params.table;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const body = req.body || {};
  const keys = Object.keys(body);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  try {
    const r = await pool.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => body[k])
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tables/:table/:id', async (req, res) => {
  const table = req.params.table;
  const id = req.params.id;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const body = req.body || {};
  const keys = Object.keys(body);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields provided' });
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const pkCol = getPkCol(table);
  try {
    const r = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE ${pkCol} = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => body[k]), id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tables/:table/:id', async (req, res) => {
  const table = req.params.table;
  const id = req.params.id;
  if (!TABLE_WHITELIST.includes(table)) return res.status(400).json({ error: 'Invalid table' });
  const pkCol = getPkCol(table);
  try {
    const r = await pool.query(`DELETE FROM ${table} WHERE ${pkCol} = $1 RETURNING *`, [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
