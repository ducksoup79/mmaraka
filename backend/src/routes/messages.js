const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { sendPushNotification } = require('../lib/push');

const router = express.Router();
router.use(verifyToken);

// Total unread count for current user (for nav badge)
router.get('/unread-count', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT COUNT(*)::int AS count FROM message WHERE recipient_id = $1 AND read_at IS NULL',
      [req.user.client_id]
    );
    res.json({ count: r.rows[0]?.count ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get another user's public info for starting a conversation
router.get('/peer/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id === req.user.client_id) {
      return res.status(400).json({ error: 'Invalid client id' });
    }
    const r = await pool.query(
      'SELECT client_id, username FROM client WHERE client_id = $1 AND active = TRUE',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List conversations: other user, last message, unread count
router.get('/conversations', async (req, res) => {
  try {
    const me = req.user.client_id;
    const r = await pool.query(
      `WITH pairs AS (
        SELECT DISTINCT
          CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id
        FROM message
        WHERE sender_id = $1 OR recipient_id = $1
      ),
      last_msg AS (
        SELECT DISTINCT ON (CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END)
          CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id,
          m.body AS last_body,
          m.created_at AS last_at,
          m.sender_id = $1 AS i_sent_last
        FROM message m
        WHERE m.sender_id = $1 OR m.recipient_id = $1
        ORDER BY CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END, m.created_at DESC
      ),
      unread AS (
        SELECT sender_id AS other_id, COUNT(*) AS n
        FROM message
        WHERE recipient_id = $1 AND read_at IS NULL
        GROUP BY sender_id
      )
      SELECT
        p.other_id,
        c.username AS other_username,
        lm.last_body,
        lm.last_at,
        lm.i_sent_last,
        COALESCE(u.n, 0)::int AS unread_count
      FROM pairs p
      JOIN client c ON c.client_id = p.other_id
      LEFT JOIN last_msg lm ON lm.other_id = p.other_id
      LEFT JOIN unread u ON u.other_id = p.other_id
      ORDER BY lm.last_at DESC NULLS LAST`,
      [me]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages between me and :with (query param)
router.get('/', async (req, res) => {
  try {
    const me = req.user.client_id;
    const withId = parseInt(req.query.with, 10);
    if (!Number.isFinite(withId) || withId === me) {
      return res.status(400).json({ error: 'Invalid or missing "with" (other client_id)' });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before, 10) : null;

    let query = `
      SELECT m.message_id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at,
             s.username AS sender_username
      FROM message m
      JOIN client s ON s.client_id = m.sender_id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
    `;
    const params = [me, withId];
    if (before) {
      params.push(before);
      query += ` AND m.message_id < $${params.length}`;
    }
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const r = await pool.query(query, params);
    const messages = r.rows.reverse();

    // Mark messages from the other user as read
    await pool.query(
      `UPDATE message SET read_at = NOW() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [me, withId]
    );

    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send a message
router.post('/', async (req, res) => {
  try {
    const senderId = req.user.client_id;
    const { recipient_id, body } = req.body || {};
    const recipientId = parseInt(recipient_id, 10);
    if (!Number.isFinite(recipientId) || recipientId === senderId) {
      return res.status(400).json({ error: 'Valid recipient_id required' });
    }
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return res.status(400).json({ error: 'Message body required' });
    if (text.length > 10000) return res.status(400).json({ error: 'Message too long' });

    const r = await pool.query(
      `INSERT INTO message (sender_id, recipient_id, body) VALUES ($1, $2, $3)
       RETURNING message_id, sender_id, recipient_id, body, read_at, created_at`,
      [senderId, recipientId, text]
    );
    const row = r.rows[0];
    const sender = await pool.query('SELECT username FROM client WHERE client_id = $1', [senderId]);
    const senderUsername = sender.rows[0]?.username || 'Someone';
    res.status(201).json({
      ...row,
      sender_username: sender.rows[0]?.username || '',
    });
    // Notify recipient with a push (fire-and-forget)
    const recipientToken = await pool.query(
      'SELECT token FROM push_tokens WHERE client_id = $1 LIMIT 1',
      [recipientId]
    );
    if (recipientToken.rows[0]?.token) {
      const bodyPreview = text.length > 60 ? text.slice(0, 57) + '...' : text;
      sendPushNotification(
        recipientToken.rows[0].token,
        `@${senderUsername}`,
        bodyPreview,
        { type: 'message', sender_id: senderId, sender_username: senderUsername, recipient_id: recipientId }
      ).catch((err) => console.error('[push] message notify failed:', err.message));
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark messages from a user as read (optional, GET thread already does this)
router.patch('/read', async (req, res) => {
  try {
    const me = req.user.client_id;
    const withId = parseInt(req.body?.with, 10);
    if (!Number.isFinite(withId)) return res.status(400).json({ error: 'Valid "with" (client_id) required' });
    await pool.query(
      `UPDATE message SET read_at = NOW() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
      [me, withId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete entire conversation with another user (all messages between me and :withId)
router.delete('/conversations/:withId', async (req, res) => {
  try {
    const me = req.user.client_id;
    const withId = parseInt(req.params.withId, 10);
    if (!Number.isFinite(withId)) {
      return res.status(400).json({ error: 'Invalid conversation' });
    }
    const r = await pool.query(
      `DELETE FROM message
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       RETURNING message_id`,
      [me, withId]
    );
    res.json({ deleted: r.rowCount ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
