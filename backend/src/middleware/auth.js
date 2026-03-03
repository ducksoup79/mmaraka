const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const r = await pool.query(
      `SELECT c.client_id, c.username, c.email, is_admin, c.client_role_id, c.location_id, c.whatsapp, c.country_code, cr.client_role, l.location_name
       FROM client c
       JOIN client_role cr ON c.client_role_id = cr.client_role_id
       LEFT JOIN location l ON c.location_id = l.location_id
       WHERE c.client_id = $1 AND c.active = TRUE`,
      [decoded.sub]
    );
    if (r.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    req.user = r.rows[0];
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session Expired, please refresh page' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

module.exports = { verifyToken, requireAdmin, JWT_SECRET };
