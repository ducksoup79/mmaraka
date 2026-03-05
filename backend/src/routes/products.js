/**
 * Product listing routes under /api/products.
 * Listings join product + product_category + client (seller/buyer). Protected routes use verifyToken.
 */
const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { sendPushToMany } = require('../lib/push');

const router = express.Router();

/** List all available product listings (status=avail), ordered by position and date. */
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT pl.listing_id, pl.product_id, pl.client_id, pl.status, pl.listing_date, pl.listing_expires_at, pl.product_position,
             p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
             pc.category_name, c.username AS seller_username
      FROM product_listing pl
      JOIN product p ON p.product_id = pl.product_id
      JOIN product_category pc ON pc.category_id = p.category_id
      JOIN client c ON c.client_id = pl.client_id
      WHERE pl.status = 'avail'
      ORDER BY pl.product_position DESC, pl.listing_date DESC
    `);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// All of the logged-in client's listings (avail, sold, dormant) for My Listings page
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pl.listing_id, pl.product_id, pl.client_id, pl.buyer_id, pl.status, pl.listing_date, pl.listing_expires_at, pl.product_position,
              p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
              pc.category_name, c.username AS seller_username,
              buyer.username AS buyer_username
       FROM product_listing pl
       JOIN product p ON p.product_id = pl.product_id
       JOIN product_category pc ON pc.category_id = p.category_id
       JOIN client c ON c.client_id = pl.client_id
       LEFT JOIN client buyer ON buyer.client_id = pl.buyer_id
       WHERE pl.client_id = $1
       ORDER BY pl.listing_date DESC`,
      [req.user.client_id]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Single listing by id (listing_id). */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const r = await pool.query(
      `SELECT pl.listing_id, pl.product_id, pl.client_id, pl.buyer_id, pl.status,
               p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
               pc.category_name,
               c.username AS seller_username,
               buyer.username AS buyer_username
       FROM product_listing pl
       JOIN product p ON p.product_id = pl.product_id
       JOIN product_category pc ON pc.category_id = p.category_id
       JOIN client c ON c.client_id = pl.client_id
       LEFT JOIN client buyer ON buyer.client_id = pl.buyer_id
       WHERE pl.listing_id = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Create product + listing; product_position from user's role listing_priority. Optionally send push to other users. */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { product_name, product_description, product_image_path, product_price, category_id } = req.body;
    if (!product_name || product_price == null || !category_id) {
      return res.status(400).json({ error: 'product_name, product_price, category_id required' });
    }
    const roleRes = await pool.query(
      'SELECT listing_priority FROM client_role WHERE client_role_id = $1',
      [req.user.client_role_id]
    );
    const priority = (roleRes.rows[0] && roleRes.rows[0].listing_priority) || 1;
    const productPosition = priority * 100;
    const productIns = await pool.query(
      `INSERT INTO product (product_name, product_description, product_image_path, product_price, category_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING product_id`,
      [product_name, product_description || null, product_image_path || null, product_price, category_id]
    );
    const product_id = productIns.rows[0].product_id;
    await pool.query(
      `INSERT INTO product_listing (product_id, client_id, product_position)
       VALUES ($1, $2, $3)`,
      [product_id, req.user.client_id, productPosition]
    );
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id, status, listing_date, listing_expires_at FROM product_listing WHERE product_id = $1 ORDER BY listing_id DESC LIMIT 1',
      [product_id]
    );
    res.status(201).json(listing.rows[0]);
    // Notify all registered devices (except the poster) about new listing
    const productName = product_name?.slice(0, 50) || 'New item';
    const tokensResult = await pool.query(
      'SELECT token FROM push_tokens WHERE client_id != $1',
      [req.user.client_id]
    );
    const tokens = tokensResult.rows.map((r) => r.token).filter(Boolean);
    if (tokens.length > 0) {
      sendPushToMany(
        tokens,
        'New listing on Mmaraka',
        productName,
        { type: 'product', listing_id: listing.rows[0]?.listing_id }
      ).catch((err) => console.error('[push] new listing notify failed:', err.message));
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Mark listing as sold, set buyer_id, and create a message to the seller. */
router.patch('/:id/buy', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const r = await pool.query(
      `UPDATE product_listing
       SET status = 'sold', buyer_id = $2, updated_at = NOW()
       WHERE listing_id = $1 AND status = 'avail'
       RETURNING listing_id, product_id, client_id, status, updated_at`,
      [id, req.user.client_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Listing not found or already sold' });
    const row = r.rows[0];
    const sellerId = row.client_id;
    const buyerId = req.user.client_id;
    const productId = row.product_id;
    const productRow = await pool.query('SELECT product_name FROM product WHERE product_id = $1', [productId]);
    const productName = productRow.rows[0]?.product_name || 'your item';
    const buyerRow = await pool.query('SELECT username FROM client WHERE client_id = $1', [buyerId]);
    const buyerUsername = buyerRow.rows[0]?.username || 'A buyer';
    const sellerRow = await pool.query('SELECT username FROM client WHERE client_id = $1', [sellerId]);
    const sellerUsername = sellerRow.rows[0]?.username || 'Seller';
    const messageBody = `I've bought your listing: "${productName}". You can arrange handover via Messages. — @${buyerUsername}`;
    await pool.query(
      'INSERT INTO message (sender_id, recipient_id, body) VALUES ($1, $2, $3)',
      [buyerId, sellerId, messageBody]
    );
    res.json({ ...row, seller_username: sellerUsername });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update product fields and optionally listing status (avail/sold/dormant). Only listing owner. */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const { product_name, product_description, product_image_path, product_price, category_id, status } = req.body;
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id FROM product_listing WHERE listing_id = $1',
      [id]
    );
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    const product_id = listing.rows[0].product_id;
    await pool.query(
      `UPDATE product SET product_name = COALESCE($1, product_name), product_description = COALESCE($2, product_description),
        product_image_path = COALESCE($3, product_image_path), product_price = COALESCE($4, product_price),
        category_id = COALESCE($5, category_id), updated_at = NOW()
       WHERE product_id = $6`,
      [product_name ?? null, product_description ?? null, product_image_path ?? null, product_price ?? null, category_id ?? null, product_id]
    );
    if (status !== undefined && status !== null) {
      const s = String(status).toLowerCase();
      if (['avail', 'sold', 'dormant'].includes(s)) {
        if (s === 'avail') {
          await pool.query(
            `UPDATE product_listing SET status = 'avail', buyer_id = NULL, listing_expires_at = NOW() + INTERVAL '3 days', updated_at = NOW() WHERE listing_id = $1`,
            [id]
          );
        } else {
          await pool.query(
            `UPDATE product_listing SET status = $1, updated_at = NOW() WHERE listing_id = $2`,
            [s, id]
          );
        }
      }
    }
    const r = await pool.query(
      `SELECT pl.listing_id, pl.product_id, pl.client_id, pl.status,
               p.product_name, p.product_description, p.product_image_path, p.product_price, p.category_id,
               pc.category_name
       FROM product_listing pl
       JOIN product p ON p.product_id = pl.product_id
       JOIN product_category pc ON pc.category_id = p.category_id
       WHERE pl.listing_id = $1`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Delete listing and its product. Only listing owner. */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid listing id' });
    const listing = await pool.query(
      'SELECT listing_id, product_id, client_id FROM product_listing WHERE listing_id = $1',
      [id]
    );
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    const product_id = listing.rows[0].product_id;
    await pool.query('DELETE FROM product_listing WHERE listing_id = $1', [id]);
    await pool.query('DELETE FROM product WHERE product_id = $1', [product_id]);
    res.json({ message: 'Listing deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Reinstate a dormant listing (avail again, extend expiry). Max 2 reinstates per listing. */
router.patch('/:id/reinstate', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(
      'SELECT listing_id, client_id, listing_reinstate_count FROM product_listing WHERE listing_id = $1 AND status = $2',
      [id, 'dormant']
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Dormant listing not found' });
    if (r.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your listing' });
    if (r.rows[0].listing_reinstate_count >= 2) return res.status(400).json({ error: 'Reinstate limit reached' });
    await pool.query(
      `UPDATE product_listing SET status = 'avail', listing_expires_at = NOW() + INTERVAL '3 days',
       listing_reinstate_count = listing_reinstate_count + 1, updated_at = NOW() WHERE listing_id = $1`,
      [id]
    );
    res.json({ message: 'Listing reinstated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
