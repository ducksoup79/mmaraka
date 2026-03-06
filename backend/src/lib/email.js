/**
 * Email sending for password reset and email verification.
 * Uses Mailgun only (MAILGUN_API_KEY + MAILGUN_DOMAIN). No-op if not configured or PASSWORD_RESET_BASE_URL missing.
 */
const FormData = require('form-data');
const Mailgun = require('mailgun.js');

const BASE_URL = process.env.PASSWORD_RESET_BASE_URL || process.env.BASE_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@mmaraka.com';

let mailgunClient = null;

/** Get Mailgun client (cached). Returns null if MAILGUN_API_KEY or MAILGUN_DOMAIN unset. */
function getMailgunClient() {
  if (mailgunClient !== null) return mailgunClient;
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) return null;
  const mailgun = new Mailgun(FormData);
  const opts = { username: 'api', key };
  if (process.env.MAILGUN_EU === 'true') opts.url = 'https://api.eu.mailgun.net';
  mailgunClient = mailgun.client(opts);
  return mailgunClient;
}

/** True if Mailgun is configured. */
function isMailgunConfigured() {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/**
 * Send a single email via Mailgun. No-op if Mailgun not configured.
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} text - Plain text body
 * @param {string} [html] - Optional HTML body
 * @param {string} [from] - From address (default MAIL_FROM)
 * @returns {'mailgun'|null} - 'mailgun' if sent, null if not configured
 */
async function sendEmail(to, subject, text, html, from) {
  const mg = getMailgunClient();
  if (!mg) return null;
  const fromAddr = from || MAIL_FROM;
  const domain = process.env.MAILGUN_DOMAIN;
  await mg.messages.create(domain, {
    from: fromAddr,
    to: [to],
    subject,
    text,
    html: html || text,
  });
  return 'mailgun';
}

/**
 * Send password reset email. No-op if Mailgun/base URL not configured.
 */
async function sendPasswordResetEmail(toEmail, token) {
  if (!BASE_URL.trim()) return null;
  const resetUrl = `${BASE_URL.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Mmaraka – Reset your password';
  const text = `You requested a password reset. Open this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
  const html = `<p>You requested a password reset. Click the link below to set a new password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`;
  return await sendEmail(toEmail, subject, text, html);
}

/**
 * Send email verification link (for new signups). No-op if not configured.
 */
async function sendVerificationEmail(toEmail, token) {
  if (!BASE_URL.trim()) return null;
  const verifyUrl = `${BASE_URL.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = 'Mmaraka – Verify your email';
  const text = `Thanks for signing up. Verify your email by opening this link (valid for 24 hours):\n\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`;
  const html = `<p>Thanks for signing up. Verify your email by clicking the button below (valid for 24 hours):</p><p style="margin: 24px 0;"><a href="${verifyUrl}" style="display: inline-block; background: #2D6A4F; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify my email</a></p><p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't create an account, ignore this email.</p>`;
  return await sendEmail(toEmail, subject, text, html);
}

/**
 * Verify email config (for admin diagnostics). Returns { ok: true } or { ok: false, error: string }.
 */
async function verifyTransport() {
  if (isMailgunConfigured()) return { ok: true };
  return { ok: false, error: 'Email not configured (set MAILGUN_API_KEY and MAILGUN_DOMAIN)' };
}

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmail,
  getMailgunClient,
  isMailgunConfigured,
  verifyTransport,
};
