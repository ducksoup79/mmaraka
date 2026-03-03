#!/usr/bin/env node
/**
 * Create message table for client-to-client messaging.
 * Run from Backend folder: node migrations/run-messages-table.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message (
        message_id   SERIAL PRIMARY KEY,
        sender_id    INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
        recipient_id INT NOT NULL REFERENCES client(client_id) ON DELETE CASCADE,
        body         TEXT NOT NULL,
        read_at      TIMESTAMP,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_sender_recipient
      ON message (sender_id, recipient_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_recipient_sender
      ON message (recipient_id, sender_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_created
      ON message (created_at DESC)
    `);
    console.log('Migration complete: message table ready.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
