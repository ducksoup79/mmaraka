#!/usr/bin/env node
/**
 * Add screenshot_path to error_report for report attachments.
 * Run from Backend folder: node migrations/run-error-report-screenshot.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function run() {
  try {
    await pool.query('ALTER TABLE error_report ADD COLUMN IF NOT EXISTS screenshot_path VARCHAR(500)');
    console.log('Migration complete: error_report.screenshot_path added (if missing).');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
