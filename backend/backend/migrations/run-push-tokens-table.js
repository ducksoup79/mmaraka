#!/usr/bin/env node
/**
 * Create push_tokens table for Expo push notifications.
 * Run from Backend folder: node migrations/run-push-tokens-table.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        client_id   INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
        token      VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (client_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens (token)
    `);
    console.log('Migration complete: push_tokens table ready.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
