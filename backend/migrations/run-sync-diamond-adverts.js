#!/usr/bin/env node
/**
 * Sync Diamond clients' services into the ad bar (advert_list).
 * Run from Backend folder: node migrations/run-sync-diamond-adverts.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

const SQL = `
INSERT INTO advert_list (service_id, active)
SELECT s.service_id, TRUE
FROM service s
JOIN client c ON c.client_id = s.client_id
JOIN client_role cr ON cr.client_role_id = c.client_role_id
WHERE cr.client_role = 'Diamond'
AND NOT EXISTS (SELECT 1 FROM advert_list a WHERE a.service_id = s.service_id)
`;

async function run() {
  try {
    const r = await pool.query(SQL);
    const inserted = r.rowCount ?? 0;
    console.log(`Sync complete: ${inserted} service(s) added to the ad bar for existing Diamond clients.`);
  } catch (e) {
    console.error('Sync failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
