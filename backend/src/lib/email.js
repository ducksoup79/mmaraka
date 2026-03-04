const nodemailer = require('nodemailer');

const BASE_URL = process.env.PASSWORD_RESET_BASE_URL || process.env.BASE_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@mmaraka.com';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

/**
 * Send password reset email. No-op if SMTP or PASSWORD_RESET_BASE_URL not configured.
 * @param {string} toEmail - Recipient email
 * @param {string} token - Reset token (included in link)
 */
async function sendPasswordResetEmail(toEmail, token) {
  if (!BASE_URL.trim()) return;
  const trans = getTransporter();
  if (!trans) return;
  const resetUrl = `${BASE_URL.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  await trans.sendMail({
    from: MAIL_FROM,
    to: toEmail,
    subject: 'Mmaraka – Reset your password',
    text: `You requested a password reset. Open this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>You requested a password reset. Click the link below to set a new password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  });
}

/**
 * Send email verification link (for new signups). No-op if SMTP or base URL not configured.
 * @param {string} toEmail - Recipient email
 * @param {string} token - Verification token (included in link)
 */
async function sendVerificationEmail(toEmail, token) {
  if (!BASE_URL.trim()) return;
  const trans = getTransporter();
  if (!trans) return;
  const verifyUrl = `${BASE_URL.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  await trans.sendMail({
    from: MAIL_FROM,
    to: toEmail,
    subject: 'Mmaraka – Verify your email',
    text: `Thanks for signing up. Verify your email by opening this link (valid for 24 hours):\n\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
    html: `<p>Thanks for signing up. Verify your email by clicking the button below (valid for 24 hours):</p><p style="margin: 24px 0;"><a href="${verifyUrl}" style="display: inline-block; background: #2D6A4F; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify my email</a></p><p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't create an account, ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, getTransporter };
