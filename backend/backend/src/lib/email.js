/**
 * Email sending for password reset and email verification.
 * Uses Mailgun when MAILGUN_API_KEY + MAILGUN_DOMAIN are set, otherwise SMTP (nodemailer).
 * No-op if neither is configured or PASSWORD_RESET_BASE_URL is missing for reset/verify.
 */
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const nodemailer = require('nodemailer');

const BASE_URL = process.env.PASSWORD_RESET_BASE_URL || process.env.BASE_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@mmaraka.com';

let mailgunClient = null;
let transporter = null;

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

/** Builds and caches nodemailer transport from SMTP_* env. Returns null if SMTP_HOST unset. */
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    ...(port === 587 && !secure && { requireTLS: true }),
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

/** True if Mailgun is configured. */
function isMailgunConfigured() {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/** True if SMTP is configured. */
function isSmtpConfigured() {
  return !!process.env.SMTP_HOST;
}

/**
 * Send a single email. Uses Mailgun if configured, else SMTP. No-op if neither configured.
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} text - Plain text body
 * @param {string} [html] - Optional HTML body
 * @param {string} [from] - From address (default MAIL_FROM)
 */
async function sendEmail(to, subject, text, html, from) {
  const fromAddr = from || MAIL_FROM;
  const mg = getMailgunClient();
  if (mg) {
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
  const trans = getTransporter();
  if (trans) {
    await trans.sendMail({ from: fromAddr, to, subject, text, html: html || text });
    return 'smtp';
  }
  return null;
}

/**
 * Send password reset email. No-op if email not configured or PASSWORD_RESET_BASE_URL not set.
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
 * Send email verification link (for new signups). No-op if email not configured or base URL not set.
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
 * Mailgun: returns ok if env is set (no network call). SMTP: runs verify() with 15s timeout.
 */
async function verifyTransport() {
  if (isMailgunConfigured()) {
    return { ok: true };
  }
  const trans = getTransporter();
  if (!trans) return { ok: false, error: 'Email not configured (set MAILGUN_API_KEY + MAILGUN_DOMAIN or SMTP_HOST)' };
  try {
    await Promise.race([
      trans.verify(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP connection timeout (15s)')), 15000)),
    ]);
    return { ok: true };
  } catch (e) {
    const msg = e.response || e.message || String(e);
    return { ok: false, error: msg };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmail,
  getTransporter,
  getMailgunClient,
  isMailgunConfigured,
  isSmtpConfigured,
  verifyTransport,
};
