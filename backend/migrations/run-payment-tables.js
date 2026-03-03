#!/usr/bin/env node
/**
 * Add payment_config and subscription_order tables for PayPal plan upgrades.
 * Run from Backend folder: node migrations/run-payment-tables.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_config (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT
      )
    `);
    await pool.query(`
      INSERT INTO payment_config (key, value) VALUES
        ('paypal_client_id', ''),
        ('paypal_client_secret', ''),
        ('paypal_sandbox', 'true')
      ON CONFLICT (key) DO NOTHING
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_order (
        order_id VARCHAR(64) PRIMARY KEY,
        client_id INT NOT NULL REFERENCES client(client_id),
        client_role_id INT NOT NULL REFERENCES client_role(client_role_id),
        amount DECIMAL(10, 2) NOT NULL,
        currency_code VARCHAR(8) NOT NULL DEFAULT 'BWP',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS paypal_subscription (
        paypal_subscription_id VARCHAR(64) PRIMARY KEY,
        client_id INT NOT NULL REFERENCES client(client_id),
        client_role_id INT NOT NULL REFERENCES client_role(client_role_id),
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Migration complete: payment_config and subscription_order tables ready.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
