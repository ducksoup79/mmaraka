/**
 * Service routes under /api/services.
 * One service per client; service_listing controls visibility. Protected routes use verifyToken.
 */
const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/** List all active services (service_status=true), with client info. */
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT s.service_id, s.client_id, s.service_logo_path, s.service_name, s.service_description,
             sl.service_listing_id, sl.service_position, sl.service_status, sl.service_listing_date,
             c.username AS client_username, c.first_name AS client_first_name, c.last_name AS client_last_name,
             c.email AS client_email, c.whatsapp AS client_whatsapp, c.country_code AS client_country_code
      FROM service s
      JOIN service_listing sl ON sl.service_id = s.service_id
      JOIN client c ON c.client_id = s.client_id
      WHERE sl.service_status = TRUE
      ORDER BY sl.service_position DESC, sl.service_listing_date DESC
    `);
    res.json(r.rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Current user's service (must be before /:id)
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.service_id, s.client_id, s.service_logo_path, s.service_name, s.service_description
       FROM service s
       LEFT JOIN service_listing sl ON sl.service_id = s.service_id
       WHERE s.client_id = $1
       LIMIT 1`,
      [req.user.client_id]
    );
    if (r.rows.length === 0) return res.json(null);
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Single service by id; only if listed and active. */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `SELECT s.service_id, s.client_id, s.service_logo_path, s.service_name, s.service_description
       FROM service s
       JOIN service_listing sl ON sl.service_id = s.service_id
       WHERE s.service_id = $1 AND sl.service_status = TRUE`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create service + service_listing. One service per client. */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { service_name, service_description, service_logo_path } = req.body;
    if (!service_name) return res.status(400).json({ error: 'service_name required' });
    const existing = await pool.query(
      'SELECT service_id FROM service WHERE client_id = $1 LIMIT 1',
      [req.user.client_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You can only list one service. Edit or delete your existing service first.' });
    }
    const roleRes = await pool.query(
      'SELECT listing_priority FROM client_role WHERE client_role_id = $1',
      [req.user.client_role_id]
    );
    const priority = (roleRes.rows[0] && roleRes.rows[0].listing_priority) || 1;
    const productPosition = priority * 100;
    const ins = await pool.query(
      `INSERT INTO service (client_id, service_logo_path, service_name, service_description)
       VALUES ($1, $2, $3, $4) RETURNING service_id`,
      [req.user.client_id, service_logo_path || null, service_name, service_description || null]
    );
    const service_id = ins.rows[0].service_id;
    await pool.query(
      `INSERT INTO service_listing (service_id, service_position, service_status) VALUES ($1, $2, TRUE)`,
      [service_id, productPosition]
    );
    res.status(201).json({ service_id, service_name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update service (owner only). */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid service id' });
    const { service_name, service_description, service_logo_path } = req.body;
    const r = await pool.query(
      'SELECT service_id, client_id FROM service WHERE service_id = $1',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (r.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your service' });
    await pool.query(
      `UPDATE service SET service_name = COALESCE($1, service_name), service_description = COALESCE($2, service_description),
        service_logo_path = COALESCE($3, service_logo_path), updated_at = NOW()
       WHERE service_id = $4`,
      [service_name ?? null, service_description ?? null, service_logo_path ?? null, id]
    );
    const updated = await pool.query(
      'SELECT service_id, client_id, service_logo_path, service_name, service_description FROM service WHERE service_id = $1',
      [id]
    );
    res.json(updated.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete service (owner only). */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid service id' });
    const r = await pool.query(
      'SELECT service_id, client_id FROM service WHERE service_id = $1',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    if (r.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your service' });
    await pool.query('DELETE FROM service WHERE service_id = $1', [id]);
    res.json({ message: 'Service deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
