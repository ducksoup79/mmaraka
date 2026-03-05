#!/usr/bin/env node
/**
 * Set up email (SMTP) for the Mmaraka backend so password reset and
 * verification emails work. Updates .env with email-related variables.
 *
 * Usage:
 *   node scripts/setup-email.js
 *     Interactive: prompts for SMTP and base URL, then writes .env.
 *
 *   SMTP_HOST=... SMTP_USER=... SMTP_PASS=... PASSWORD_RESET_BASE_URL=... node scripts/setup-email.js
 *     Non-interactive: reads from environment and merges into .env.
 *
 *   node scripts/setup-email.js --test your@email.com
 *     After configuring, send a test email to the given address.
 */
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLE_PATH = path.join(ROOT, '.env.example');

const EMAIL_KEYS = [
  'PASSWORD_RESET_BASE_URL',
  'MAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
];

function parseEnv(content) {
  const out = {};
  const lines = (content || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Read .env; if missing, copy from .env.example and return parsed. */
function loadOrCreateEnv() {
  if (fs.existsSync(ENV_PATH)) {
    return parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  }
  if (fs.existsSync(EXAMPLE_PATH)) {
    const content = fs.readFileSync(EXAMPLE_PATH, 'utf8');
    fs.writeFileSync(ENV_PATH, content, 'utf8');
    console.log('Created .env from .env.example.');
    return parseEnv(content);
  }
  return {};
}

/** Write .env: update only email-related lines, keep rest of file intact. */
function writeEnvMerged(envMap) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const lines = content.split(/\r?\n/);
  const out = [];
  let hadEmailBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf('=');
    const key = eq > -1 ? trimmed.slice(0, eq).trim() : '';

    if (EMAIL_KEYS.includes(key)) {
      if (envMap[key] !== undefined) {
        out.push(`${key}=${envMap[key]}`);
      } else {
        out.push(line);
      }
      if (key.startsWith('SMTP_') || key === 'MAIL_FROM' || key === 'PASSWORD_RESET_BASE_URL') hadEmailBlock = true;
      continue;
    }
    if (trimmed.startsWith('# Email') || trimmed.startsWith('# Base URL for password reset')) {
      hadEmailBlock = true;
    }
    out.push(line);
  }

  if (!hadEmailBlock && (envMap.SMTP_HOST || envMap.PASSWORD_RESET_BASE_URL)) {
    out.push('');
    out.push('# Email (for password reset and verification). If not set, no email is sent.');
    out.push('PASSWORD_RESET_BASE_URL=' + (envMap.PASSWORD_RESET_BASE_URL || ''));
    out.push('MAIL_FROM=' + (envMap.MAIL_FROM || envMap.SMTP_USER || ''));
    out.push('SMTP_HOST=' + (envMap.SMTP_HOST || ''));
    out.push('SMTP_PORT=' + (envMap.SMTP_PORT || '587'));
    out.push('SMTP_SECURE=' + (envMap.SMTP_SECURE || 'false'));
    out.push('SMTP_USER=' + (envMap.SMTP_USER || ''));
    out.push('SMTP_PASS=' + (envMap.SMTP_PASS || ''));
  }

  fs.writeFileSync(ENV_PATH, out.join('\n'), 'utf8');
}

function prompt(rl, question, defaultVal) {
  const def = defaultVal ? ` [${defaultVal}]` : '';
  return new Promise((resolve) => {
    rl.question(question + def + ': ', (answer) => {
      resolve((answer || defaultVal || '').trim());
    });
  });
}

async function runInteractive() {
  const existing = loadOrCreateEnv();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Mmaraka – Email setup (SMTP)\n');
  console.log('Values will be written to .env. Leave blank to keep existing or skip.\n');

  const SMTP_HOST = await prompt(rl, 'SMTP host', existing.SMTP_HOST || 'smtp.gmail.com');
  const SMTP_PORT = await prompt(rl, 'SMTP port', existing.SMTP_PORT || '587');
  const SMTP_SECURE = await prompt(rl, 'Use TLS? (true/false)', existing.SMTP_SECURE || 'false');
  const SMTP_USER = await prompt(rl, 'SMTP user (email or username)', existing.SMTP_USER);
  const SMTP_PASS = await prompt(rl, 'SMTP password (app password for Gmail)', existing.SMTP_PASS);
  const PASSWORD_RESET_BASE_URL = await prompt(
    rl,
    'Password reset base URL (e.g. https://mmaraka.com – where users open the reset link)',
    existing.PASSWORD_RESET_BASE_URL || existing.BASE_URL || ''
  );
  const MAIL_FROM = await prompt(rl, '"From" email address', existing.MAIL_FROM || SMTP_USER || 'noreply@mmaraka.com');

  rl.close();

  return {
    ...existing,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE: SMTP_SECURE === 'true' ? 'true' : 'false',
    SMTP_USER,
    SMTP_PASS,
    PASSWORD_RESET_BASE_URL,
    MAIL_FROM,
  };
}

function runFromEnv() {
  const existing = loadOrCreateEnv();
  const env = process.env;
  const merged = { ...existing };
  for (const key of EMAIL_KEYS) {
    if (env[key] !== undefined && env[key] !== '') merged[key] = env[key];
  }
  if (env.PASSWORD_RESET_BASE_URL === undefined && env.BASE_URL) merged.PASSWORD_RESET_BASE_URL = env.BASE_URL;
  return merged;
}

async function sendTestEmail(toEmail) {
  require('dotenv').config({ path: ENV_PATH });
  const { getTransporter } = require('../src/lib/email');
  const trans = getTransporter();
  if (!trans) {
    console.error('Cannot send test: SMTP not configured (SMTP_HOST missing).');
    process.exit(1);
  }
  const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@mmaraka.com';
  await trans.sendMail({
    from: MAIL_FROM,
    to: toEmail,
    subject: 'Mmaraka – Email test',
    text: 'If you received this, the Mmaraka server email setup is working.',
    html: '<p>If you received this, the Mmaraka server email setup is working.</p>',
  });
  console.log('Test email sent to', toEmail);
}

async function main() {
  const args = process.argv.slice(2);
  const testEmail = args[0] === '--test' ? args[1] : null;

  const hasEnv = process.env.SMTP_HOST || process.env.SMTP_USER;
  const envMap = hasEnv ? runFromEnv() : await runInteractive();

  writeEnvMerged(envMap);
  console.log('Updated .env with email configuration.');

  if (envMap.SMTP_HOST) {
    console.log('\nEmail config:');
    console.log('  SMTP_HOST=', envMap.SMTP_HOST);
    console.log('  SMTP_PORT=', envMap.SMTP_PORT || '587');
    console.log('  SMTP_USER=', envMap.SMTP_USER || '(not set)');
    console.log('  PASSWORD_RESET_BASE_URL=', envMap.PASSWORD_RESET_BASE_URL || '(not set)');
    if (!envMap.PASSWORD_RESET_BASE_URL) {
      console.log('\nSet PASSWORD_RESET_BASE_URL to the web app URL (e.g. https://mmaraka.com) so reset links work.');
    }
  }

  if (testEmail) await sendTestEmail(testEmail);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
