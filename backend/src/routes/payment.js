const express = require('express');
const { pool } = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { getPaymentConfig } = require('../lib/payment-config');
const {
  addClientServicesToAdvertList,
  removeClientServicesFromAdvertList,
  updateClientListingPositions,
} = require('../lib/subscription-rules');

const router = express.Router();

const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE = 'https://api-m.paypal.com';

// Events that mean the subscription has ended or payment failed → downgrade to Basic
const SUBSCRIPTION_DEFAULT_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
]);

async function getPayPalAccessToken(clientId, clientSecret, sandbox) {
  const base = sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error_description || data.error || 'PayPal auth failed';
    const err = new Error(msg);
    if (msg.includes('Client Authentication') || data.error === 'invalid_client') {
      err.paypalConfig = true;
    }
    throw err;
  }
  return data.access_token;
}

/** Server-side capture by order ID (used after PayPal redirect and by capture-order). */
async function doCaptureOrder(orderId) {
  const orderRow = await pool.query(
    'SELECT order_id, client_id, client_role_id, amount, status FROM subscription_order WHERE order_id = $1',
    [orderId]
  );
  if (orderRow.rows.length === 0) return null;
  const order = orderRow.rows[0];
  if (order.status !== 'pending') return { plan: order.status === 'completed' ? 'already_completed' : order.status };

  const config = await getPaymentConfig();
  if (!config.paypal_client_id || !config.paypal_client_secret) {
    throw new Error('PayPal is not configured.');
  }

  const base = config.paypal_sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
  const accessToken = await getPayPalAccessToken(
    config.paypal_client_id,
    config.paypal_client_secret,
    config.paypal_sandbox
  );

  const captureRes = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const captureData = await captureRes.json();
  if (!captureRes.ok) {
    throw new Error(captureData.message || captureData.details?.[0]?.description || 'PayPal capture failed');
  }
  if (captureData.status !== 'COMPLETED') {
    throw new Error('Payment was not completed');
  }

  await pool.query(
    "UPDATE subscription_order SET status = 'completed' WHERE order_id = $1",
    [orderId]
  );
  await pool.query(
    'UPDATE client SET client_role_id = $1, updated_at = NOW() WHERE client_id = $2',
    [order.client_role_id, order.client_id]
  );

  const roleRow = await pool.query('SELECT client_role FROM client_role WHERE client_role_id = $1', [order.client_role_id]);
  const planName = roleRow.rows[0]?.client_role || 'Upgraded';
  await updateClientListingPositions(order.client_id, order.client_role_id).catch((err) => console.error('[doCaptureOrder] updateClientListingPositions:', err.message));
  if (planName === 'Diamond') {
    await addClientServicesToAdvertList(order.client_id).catch((err) => console.error('[doCaptureOrder] addClientServicesToAdvertList:', err.message));
  }
  return { plan: planName };
}
router.get('/config', async (req, res) => {
  try {
    const config = await getPaymentConfig();
    res.json({
      paypal_client_id: config.paypal_client_id || '',
      paypal_sandbox: config.paypal_sandbox,
      currency_code: config.currency_code || 'BWP',
      plan_ids: {
        Silver: config.paypal_plan_id_Silver || '',
        Diamond: config.paypal_plan_id_Diamond || '',
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create PayPal order for plan upgrade
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { client_role_id } = req.body || {};
    if (!client_role_id) return res.status(400).json({ error: 'client_role_id required' });
    const roleId = parseInt(client_role_id, 10);
    if (!Number.isFinite(roleId)) return res.status(400).json({ error: 'Invalid client_role_id' });

    const planRow = await pool.query(
      'SELECT client_role_id, client_role, sub_price FROM client_role WHERE client_role_id = $1',
      [roleId]
    );
    if (planRow.rows.length === 0) return res.status(400).json({ error: 'Plan not found' });
    const plan = planRow.rows[0];
    const amount = parseFloat(plan.sub_price);
    if (amount <= 0) return res.status(400).json({ error: 'That plan is free; no payment needed' });
    if (plan.client_role === 'Admin') return res.status(400).json({ error: 'Invalid plan' });

    const config = await getPaymentConfig();
    if (!config.paypal_client_id || !config.paypal_client_secret) {
      return res.status(503).json({ error: 'PayPal is not configured. Ask the admin to set up payment.' });
    }

    const base = config.paypal_sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
    const accessToken = await getPayPalAccessToken(
      config.paypal_client_id,
      config.paypal_client_secret,
      config.paypal_sandbox
    );

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: config.currency_code || 'BWP',
          value: amount.toFixed(2),
        },
        description: `${plan.client_role} plan upgrade`,
      }],
      application_context: {
        return_url: `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`}/api/payment/return`,
        cancel_url: `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`}/api/payment/cancel`,
      },
    };
    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      return res.status(400).json({ error: orderData.message || orderData.details?.[0]?.description || 'PayPal create order failed' });
    }
    const orderId = orderData.id;
    if (!orderId) return res.status(500).json({ error: 'No order ID from PayPal' });

    await pool.query(
      `INSERT INTO subscription_order (order_id, client_id, client_role_id, amount, currency_code, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [orderId, req.user.client_id, roleId, amount, config.currency_code || 'BWP']
    );

    const approvalLink = orderData.links && orderData.links.find((l) => l.rel === 'approve');
    const approvalUrl = approvalLink ? approvalLink.href : null;
    res.json({ orderId, approvalUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Capture PayPal order and upgrade client plan
router.post('/capture-order', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const orderRow = await pool.query(
      'SELECT order_id, client_id, status FROM subscription_order WHERE order_id = $1',
      [orderId]
    );
    if (orderRow.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (orderRow.rows[0].client_id !== req.user.client_id) return res.status(403).json({ error: 'Not your order' });

    const result = await doCaptureOrder(orderId);
    if (!result) return res.status(404).json({ error: 'Order not found' });
    if (result.plan === 'already_completed') {
      return res.json({ success: true, plan: 'already_completed' });
    }
    res.json({ success: true, plan: result.plan });
  } catch (e) {
    const msg = e.paypalConfig
      ? 'PayPal rejected our credentials. In Admin → Payment, ensure Test mode is checked when using Sandbox Client ID & Secret, and that the Secret is correct (no extra spaces).'
      : e.message;
    res.status(e.paypalConfig ? 502 : 500).json({ error: msg });
  }
});

// PayPal redirects here after user approves payment (no auth; capture is done server-side)
router.get('/return', async (req, res) => {
  const token = req.query.token || req.query.order_id;
  if (!token) {
    res.set('Content-Type', 'text/html');
    return res.status(400).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><p>Missing order token. Close this page and try again from the app.</p></body></html>'
    );
  }
  try {
    const result = await doCaptureOrder(token);
    if (!result) {
      res.set('Content-Type', 'text/html');
      return res.status(404).send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><p>Order not found. Close this page and return to the app.</p></body></html>'
      );
    }
    const planName = result.plan === 'already_completed' ? 'already active' : result.plan;
    res.set('Content-Type', 'text/html');
    res.send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment complete</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Payment successful</h2><p>Your plan has been upgraded${planName !== 'already active' ? ` to ${planName}` : ''}. You can close this page and return to the app.</p></body></html>`
    );
  } catch (e) {
    console.error('[payment/return]', e.message);
    res.set('Content-Type', 'text/html');
    res.status(500).send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><p>Something went wrong: ${String(e.message).replace(/</g, '&lt;')}. Close this page and contact support if the charge appears on your account.</p></body></html>`
    );
  }
});

router.get('/cancel', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment cancelled</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><p>Payment was cancelled. You can close this page and return to the app.</p></body></html>'
  );
});

// Approve PayPal subscription and upgrade client plan (monthly subscription flow)
router.post('/subscription-approved', verifyToken, async (req, res) => {
  try {
    const { subscriptionID, client_role_id } = req.body || {};
    if (!subscriptionID) return res.status(400).json({ error: 'subscriptionID required' });
    if (!client_role_id) return res.status(400).json({ error: 'client_role_id required' });
    const roleId = parseInt(client_role_id, 10);
    if (!Number.isFinite(roleId)) return res.status(400).json({ error: 'Invalid client_role_id' });

    const planRow = await pool.query(
      'SELECT client_role_id, client_role FROM client_role WHERE client_role_id = $1',
      [roleId]
    );
    if (planRow.rows.length === 0) return res.status(400).json({ error: 'Plan not found' });
    const plan = planRow.rows[0];
    if (plan.client_role === 'Admin') return res.status(400).json({ error: 'Invalid plan' });

    const config = await getPaymentConfig();
    if (!config.paypal_client_id || !config.paypal_client_secret) {
      return res.status(503).json({ error: 'PayPal is not configured.' });
    }

    const base = config.paypal_sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
    const accessToken = await getPayPalAccessToken(
      config.paypal_client_id,
      config.paypal_client_secret,
      config.paypal_sandbox
    );

    const subRes = await fetch(`${base}/v1/billing/subscriptions/${subscriptionID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      return res.status(400).json({ error: subData.message || subData.details?.[0]?.description || 'PayPal subscription lookup failed' });
    }
    const status = subData.status;
    if (status !== 'ACTIVE' && status !== 'APPROVAL_PENDING') {
      return res.status(400).json({ error: 'Subscription is not active' });
    }

    const expectedPlanId = config[`paypal_plan_id_${plan.client_role}`] || '';
    const actualPlanId = subData.plan_id || '';
    if (expectedPlanId && actualPlanId && actualPlanId !== expectedPlanId) {
      return res.status(400).json({ error: 'Subscription plan does not match' });
    }

    const existing = await pool.query(
      'SELECT paypal_subscription_id FROM paypal_subscription WHERE paypal_subscription_id = $1',
      [subscriptionID]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO paypal_subscription (paypal_subscription_id, client_id, client_role_id, status)
         VALUES ($1, $2, $3, $4)`,
        [subscriptionID, req.user.client_id, roleId, status]
      );
    }

    await pool.query(
      'UPDATE client SET client_role_id = $1, updated_at = NOW() WHERE client_id = $2',
      [roleId, req.user.client_id]
    );

    await updateClientListingPositions(req.user.client_id, roleId).catch((err) => console.error('[subscription-approved] updateClientListingPositions:', err.message));
    if (plan.client_role === 'Diamond') {
      await addClientServicesToAdvertList(req.user.client_id).catch((err) => console.error('[subscription-approved] addClientServicesToAdvertList:', err.message));
    }
    res.json({
      success: true,
      plan: plan.client_role,
    });
  } catch (e) {
    const msg = e.paypalConfig
      ? 'PayPal rejected our credentials. In Admin → Payment, ensure Test mode is checked when using Sandbox Client ID & Secret, and that the Secret is correct (no extra spaces).'
      : e.message;
    res.status(e.paypalConfig ? 502 : 500).json({ error: msg });
  }
});

/**
 * PayPal webhook: handle subscription cancelled/suspended/expired/payment failed.
 * Called with raw body (express.raw) from index.js. Verifies signature if paypal_webhook_id is set.
 */
async function handleWebhook(req, res) {
  let event;
  try {
    const raw = req.body;
    if (!raw || !Buffer.isBuffer(raw)) {
      return res.status(400).json({ error: 'Invalid body' });
    }
    event = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = event.event_type;
  const resource = event.resource || {};
  const subscriptionId = resource.id || resource.subscription_id || (resource.billing_info && resource.billing_info.billing_agreement_id);

  const config = await getPaymentConfig();

  if (config.paypal_webhook_id && config.paypal_client_id && config.paypal_client_secret) {
    const base = config.paypal_sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'] || 'SHA256withRSA';
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (transmissionId && transmissionTime && certUrl && transmissionSig) {
      const accessToken = await getPayPalAccessToken(
        config.paypal_client_id,
        config.paypal_client_secret,
        config.paypal_sandbox
      );
      const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: config.paypal_webhook_id,
          webhook_event: event,
        }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.verification_status !== 'SUCCESS') {
        console.error('[payment webhook] verification failed:', verifyData);
        return res.status(401).json({ error: 'Webhook verification failed' });
      }
    }
  }

  if (!SUBSCRIPTION_DEFAULT_EVENTS.has(eventType)) {
    return res.status(200).json({ received: true });
  }

  if (!subscriptionId) {
    console.warn('[payment webhook] subscription event missing resource.id:', eventType);
    return res.status(200).json({ received: true });
  }

  try {
    const basicRole = await pool.query(
      "SELECT client_role_id FROM client_role WHERE client_role = 'Basic' LIMIT 1"
    );
    const basicRoleId = basicRole.rows[0]?.client_role_id;
    if (!basicRoleId) {
      console.error('[payment webhook] Basic role not found');
      return res.status(200).json({ received: true });
    }

    const subRow = await pool.query(
      'SELECT client_id, client_role_id FROM paypal_subscription WHERE paypal_subscription_id = $1',
      [subscriptionId]
    );
    if (subRow.rows.length === 0) {
      return res.status(200).json({ received: true });
    }

    const { client_id } = subRow.rows[0];
    const newStatus = eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' ? 'PAYMENT_FAILED' : eventType.split('.').pop();

    await removeClientServicesFromAdvertList(client_id).catch((err) => console.error('[payment webhook] removeClientServicesFromAdvertList:', err.message));
    await pool.query(
      'UPDATE client SET client_role_id = $1, updated_at = NOW() WHERE client_id = $2',
      [basicRoleId, client_id]
    );
    await updateClientListingPositions(client_id, basicRoleId).catch((err) => console.error('[payment webhook] updateClientListingPositions:', err.message));
    await pool.query(
      'UPDATE paypal_subscription SET status = $1 WHERE paypal_subscription_id = $2',
      [newStatus, subscriptionId]
    );
  } catch (e) {
    console.error('[payment webhook] downgrade failed:', e.message);
  }

  res.status(200).json({ received: true });
}

router.handleWebhook = handleWebhook;
module.exports = router;
