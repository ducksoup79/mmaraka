const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Register or update the current user's Expo push token (call after login)
router.post('/', verifyToken, async (req, res) => {
  try {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token required' });
    }
    const clientId = req.user.client_id;
    await pool.query(
      `INSERT INTO push_tokens (client_id, token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (client_id) DO UPDATE SET token = $2, updated_at = NOW()`,
      [clientId, token.trim()]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove push token (e.g. on logout)
router.delete('/', verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM push_tokens WHERE client_id = $1', [req.user.client_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
