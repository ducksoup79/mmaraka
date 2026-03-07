#!/usr/bin/env node
/**
 * Add first_name and last_name to client table.
 * Run from Backend folder: node migrations/run-add-client-name.js
 * Uses the same DB connection as the app (.env).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query('ALTER TABLE client ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)');
    await pool.query('ALTER TABLE client ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)');
    console.log('Migration complete: client.first_name and client.last_name added (if missing).');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
