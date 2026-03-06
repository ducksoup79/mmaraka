/**
 * Auth routes: register, login, email verification, forgot/reset password, me, change-password, PATCH me.
 * All under /api/auth. Protected routes use verifyToken (req.user).
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db/pool');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../lib/email');

const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET;
const router = express.Router();

/** Create new client (Basic role), hash password, set verify_token and send verification email. */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, whatsapp, location_id, first_name, last_name, country_code } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password required' });
    }
    const roleRes = await pool.query(
      "SELECT client_role_id FROM client_role WHERE client_role = 'Basic' LIMIT 1"
    );
    const client_role_id = roleRes.rows[0]?.client_role_id || 1;
    const hash = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const whatsappVal = whatsapp === undefined || whatsapp === null || String(whatsapp).trim() === '' ? null : String(whatsapp).trim();
    const countryCodeVal = country_code === undefined || country_code === null || String(country_code).trim() === '' ? null : String(country_code).trim();
    const r = await pool.query(
      `INSERT INTO client (username, email, password_hash, client_role_id, whatsapp, country_code, location_id, first_name, last_name, verify_token, verify_token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '24 hours')
       RETURNING client_id, username, email, join_date`,
      [username, email, hash, client_role_id, whatsappVal, countryCodeVal, location_id || null, first_name || null, last_name || null, verifyToken]
    );
    try {
      await sendVerificationEmail(email.trim(), verifyToken);
    } catch (err) {
      console.error('[register] verification email failed:', err.message, err.code || '', err.response ? String(err.response).slice(0, 200) : '');
    }
    res.status(201).json(r.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: e.message });
  }
});

/** Login by email or username + password; return access_token, refresh_token, user. Update last_login and store refresh_token. */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, c.password_hash, c.is_admin, c.client_role_id, cr.client_role, c.location_id, l.location_name
       FROM client c
       JOIN client_role cr ON c.client_role_id = cr.client_role_id
       LEFT JOIN location l ON c.location_id = l.location_id
       WHERE (c.email = $1 OR c.username = $1) AND c.active = TRUE`,
      [email.trim()]
    );
    if (r.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, r.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    await pool.query('UPDATE client SET last_login = NOW() WHERE client_id = $1', [r.rows[0].client_id]);
    const access = jwt.sign({ sub: r.rows[0].client_id }, JWT_SECRET, { expiresIn: '1h' });
    const refresh = jwt.sign({ sub: r.rows[0].client_id }, REFRESH_SECRET, { expiresIn: '7d' });
    await pool.query('UPDATE client SET refresh_token = $1 WHERE client_id = $2', [refresh, r.rows[0].client_id]);
    res.json({
      access_token: access,
      refresh_token: refresh,
      user: { client_id: r.rows[0].client_id, username: r.rows[0].username, email: r.rows[0].email, is_admin: r.rows[0].is_admin, client_role_id: r.rows[0].client_role_id, client_role: r.rows[0].client_role, location_id: r.rows[0].location_id, location_name: r.rows[0].location_name },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Verify email: token in query; set client_verified=true and clear verify_token. */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    const r = await pool.query(
      'SELECT client_id FROM client WHERE verify_token = $1 AND verify_token_expiry > NOW()',
      [token]
    );
    if (r.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    await pool.query('UPDATE client SET client_verified = TRUE, verify_token = NULL, verify_token_expiry = NULL WHERE client_id = $1', [r.rows[0].client_id]);
    res.json({ message: 'Email verified' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Forgot password: set reset_token and expiry for matching email, send reset link. Same response whether email exists (no enumeration). */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });
    const token = crypto.randomBytes(32).toString('hex');
    const r = await pool.query(
      'UPDATE client SET reset_token = $1, reset_token_expiry = NOW() + INTERVAL \'1 hour\' WHERE LOWER(email) = $2 RETURNING client_id, email',
      [token, email]
    );
    if (r.rows.length > 0) {
      try {
        await sendPasswordResetEmail(r.rows[0].email, token);
        console.log('[forgot-password] reset email sent to', r.rows[0].email);
      } catch (err) {
        console.error('[forgot-password] send email failed:', err.message, err.code || '', err.response ? String(err.response).slice(0, 200) : '');
        // still return success so we don't leak whether the email exists
      }
    }
    res.json({ message: 'If the email exists, a reset link was sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Reset password: validate token and expiry, update password_hash, clear reset_token. */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password required' });
    const r = await pool.query(
      'SELECT client_id FROM client WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );
    if (r.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE client SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE client_id = $2',
      [hash, r.rows[0].client_id]
    );
    res.json({ message: 'Password reset' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Current user (requires valid JWT). */
router.get('/me', verifyToken, (req, res) => {
  res.json(req.user);
});

/** Change password: verify current_password then set new_password. */
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const r = await pool.query(
      'SELECT password_hash FROM client WHERE client_id = $1 AND active = TRUE',
      [req.user.client_id]
    );
    if (r.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE client SET password_hash = $1, updated_at = NOW() WHERE client_id = $2',
      [hash, req.user.client_id]
    );
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update profile (username, email, whatsapp, country_code, location_id). Returns updated user. */
router.patch('/me', verifyToken, async (req, res) => {
  try {
    const { username, email, whatsapp, country_code, location_id } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (username !== undefined) { updates.push(`username = $${i++}`); values.push(username.trim()); }
    if (email !== undefined) { updates.push(`email = $${i++}`); values.push(email.trim()); }
    if (whatsapp !== undefined) { updates.push(`whatsapp = $${i++}`); values.push(whatsapp === '' || whatsapp === null ? null : String(whatsapp)); }
    if (country_code !== undefined) { updates.push(`country_code = $${i++}`); values.push(country_code === '' || country_code === null ? null : String(country_code)); }
    if (location_id !== undefined) { updates.push(`location_id = $${i++}`); values.push(location_id === '' || location_id === null ? null : location_id); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.user.client_id);
    await pool.query(
      `UPDATE client SET ${updates.join(', ')}, updated_at = NOW() WHERE client_id = $${i}`,
      values
    );
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, is_admin, c.client_role_id, c.location_id, c.whatsapp, c.country_code, l.location_name
       FROM client c
       LEFT JOIN location l ON c.location_id = l.location_id
       WHERE c.client_id = $1`,
      [req.user.client_id]
    );
    const roleRow = await pool.query('SELECT client_role FROM client_role WHERE client_role_id = $1', [r.rows[0].client_role_id]);
    const out = { ...r.rows[0], client_role: roleRow.rows[0]?.client_role };
    res.json(out);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username or email already in use' });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
