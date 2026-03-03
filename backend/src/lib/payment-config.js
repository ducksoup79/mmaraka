const { pool } = require('../db/pool');

async function getPaymentConfig() {
  const r = await pool.query('SELECT key, value FROM payment_config');
  const map = {};
  r.rows.forEach((row) => { map[row.key] = row.value; });
  return {
    paypal_client_id: map.paypal_client_id || '',
    paypal_client_secret: map.paypal_client_secret || '',
    paypal_sandbox: map.paypal_sandbox === 'true',
    paypal_plan_id_Silver: map.paypal_plan_id_Silver || '',
    paypal_plan_id_Diamond: map.paypal_plan_id_Diamond || '',
    currency_code: (map.currency_code || 'BWP').toUpperCase(),
    paypal_webhook_id: map.paypal_webhook_id || '',
  };
}

async function setPaymentConfig({ paypal_client_id, paypal_client_secret, paypal_sandbox, paypal_plan_id_Silver, paypal_plan_id_Diamond, currency_code, paypal_webhook_id }) {
  if (paypal_client_id !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_client_id', String(paypal_client_id)]);
  }
  if (paypal_client_secret !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_client_secret', String(paypal_client_secret)]);
  }
  if (paypal_sandbox !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_sandbox', paypal_sandbox ? 'true' : 'false']);
  }
  if (paypal_plan_id_Silver !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_plan_id_Silver', String(paypal_plan_id_Silver).trim()]);
  }
  if (paypal_plan_id_Diamond !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_plan_id_Diamond', String(paypal_plan_id_Diamond).trim()]);
  }
  if (currency_code !== undefined) {
    const code = String(currency_code).trim().toUpperCase() || 'BWP';
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['currency_code', code]);
  }
  if (paypal_webhook_id !== undefined) {
    await pool.query('INSERT INTO payment_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['paypal_webhook_id', String(paypal_webhook_id).trim()]);
  }
}

module.exports = { getPaymentConfig, setPaymentConfig };
