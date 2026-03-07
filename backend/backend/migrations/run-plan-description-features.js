#!/usr/bin/env node
/**
 * Add plan_description and plan_features to client_role for admin-editable plan copy.
 * Run from Backend folder: node migrations/run-plan-description-features.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query(`
      ALTER TABLE client_role
        ADD COLUMN IF NOT EXISTS plan_description TEXT,
        ADD COLUMN IF NOT EXISTS plan_features TEXT
    `);
    console.log('Migration complete: plan_description and plan_features added to client_role.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
