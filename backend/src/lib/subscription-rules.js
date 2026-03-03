/**
 * Subscription tier rules: listing order (Basic < Silver < Diamond) and ad bar (Diamond only).
 * Used by payment (upgrade/downgrade) and admin (manual role change).
 */
const { pool } = require('../db/pool');

// When a client upgrades to Diamond, add their service(s) to the rotating ad bar (advert_list).
// Also reactivates existing rows if they had Diamond before, downgraded, then re-upgraded.
async function addClientServicesToAdvertList(clientId) {
  await pool.query(
    `UPDATE advert_list SET active = TRUE WHERE service_id IN (SELECT service_id FROM service WHERE client_id = $1)`,
    [clientId]
  );
  await pool.query(
    `INSERT INTO advert_list (service_id, active)
     SELECT s.service_id, TRUE FROM service s WHERE s.client_id = $1
     AND NOT EXISTS (SELECT 1 FROM advert_list a WHERE a.service_id = s.service_id)`,
    [clientId]
  );
}

// When a client is no longer Diamond, remove their service(s) from the ad bar (set active = FALSE).
async function removeClientServicesFromAdvertList(clientId) {
  await pool.query(
    `UPDATE advert_list SET active = FALSE WHERE service_id IN (SELECT service_id FROM service WHERE client_id = $1)`,
    [clientId]
  );
}

// Update all of a client's product and service listing positions to match their new tier (listing_priority).
// Call on both upgrade and downgrade so listings sort correctly (Diamond > Silver > Basic).
async function updateClientListingPositions(clientId, newRoleId) {
  const roleRes = await pool.query(
    'SELECT listing_priority FROM client_role WHERE client_role_id = $1',
    [newRoleId]
  );
  const priority = (roleRes.rows[0] && roleRes.rows[0].listing_priority) != null
    ? roleRes.rows[0].listing_priority
    : 1;
  const position = priority * 100;
  await pool.query(
    'UPDATE product_listing SET product_position = $1 WHERE client_id = $2',
    [position, clientId]
  );
  await pool.query(
    `UPDATE service_listing SET service_position = $1 FROM service s WHERE s.service_id = service_listing.service_id AND s.client_id = $2`,
    [position, clientId]
  );
}

/**
 * Apply subscription rules after a client's role has changed.
 * - Updates all their listing positions to the new tier.
 * - If new role is Diamond: add/reactivate their service(s) in the ad bar.
 * - If new role is not Diamond: remove their service(s) from the ad bar.
 */
async function applySubscriptionRulesForClient(clientId, newRoleId) {
  const roleRes = await pool.query(
    'SELECT client_role FROM client_role WHERE client_role_id = $1',
    [newRoleId]
  );
  const roleName = roleRes.rows[0]?.client_role || '';
  await updateClientListingPositions(clientId, newRoleId);
  if (roleName === 'Diamond') {
    await addClientServicesToAdvertList(clientId);
  } else {
    await removeClientServicesFromAdvertList(clientId);
  }
}

module.exports = {
  addClientServicesToAdvertList,
  removeClientServicesFromAdvertList,
  updateClientListingPositions,
  applySubscriptionRulesForClient,
};
