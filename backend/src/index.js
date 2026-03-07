/**
 * Mmaraka API server – Express app entry point.
 * Mounts all API routes, serves uploads, runs background cleanup jobs.
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { pool } = require('./db/pool');
const path = require('path');

// Route modules (each exports an Express router)
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const servicesRoutes = require('./routes/services');
const miscRoutes = require('./routes/misc');
const adminRoutes = require('./routes/admin');
const uploadsRoutes = require('./routes/uploads');
const paymentRoutes = require('./routes/payment');
const messagesRoutes = require('./routes/messages');
const pushTokenRoutes = require('./routes/push-token');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust first proxy (e.g. Nginx/Caddy) so req.secure and X-Forwarded-Proto work
if (isProduction) app.set('trust proxy', 1);

// Security headers (helmet sets X-Content-Type-Options, X-Frame-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
  })
);

// Redirect HTTP to HTTPS in production when behind a proxy
if (isProduction) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    const host = req.get('host') || req.hostname || 'localhost';
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

app.use(cors());
// Payment webhook needs raw body for signature verification; must be registered before express.json()
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  paymentRoutes.handleWebhook(req, res).catch(next);
});
app.use(express.json());

// Static files: product/service images stored under backend/uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API route mounting
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/misc', miscRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/push-token', pushTokenRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

/**
 * Remove sold listings older than 3 days and delete orphaned product rows
 * (products that no longer have any listing). Runs on boot and every hour.
 */
async function cleanupSoldProducts() {
  try {
    const delListings = await pool.query(
      `DELETE FROM product_listing
       WHERE status = 'sold' AND updated_at < NOW() - INTERVAL '3 days'
       RETURNING product_id`
    );
    const productIds = delListings.rows.map((r) => r.product_id);
    if (productIds.length > 0) {
      await pool.query(
        `DELETE FROM product p
         WHERE p.product_id = ANY($1)
           AND NOT EXISTS (SELECT 1 FROM product_listing pl WHERE pl.product_id = p.product_id)`,
        [productIds]
      );
    }
  } catch (e) {
    console.error('[cleanupSoldProducts] failed:', e.message);
  }
}

/**
 * Delete messages older than 7 days to limit storage. Runs on boot and every hour.
 */
async function cleanupOldMessages() {
  try {
    const r = await pool.query(
      `DELETE FROM message WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    const count = r.rowCount ?? 0;
    if (count > 0) console.log(`[cleanupOldMessages] deleted ${count} message(s) older than 7 days`);
  } catch (e) {
    console.error('[cleanupOldMessages] failed:', e.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MarketPlace API running at http://localhost:${PORT}`);
  console.log(`  Network: http://<this-machine-ip>:${PORT}`);
});

// Run cleanup on startup, then every hour
cleanupSoldProducts();
setInterval(cleanupSoldProducts, 60 * 60 * 1000);
cleanupOldMessages();
setInterval(cleanupOldMessages, 60 * 60 * 1000);
