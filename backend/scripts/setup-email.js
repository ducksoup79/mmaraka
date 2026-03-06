#!/usr/bin/env node
/**
 * Set up email (Mailgun) for the Mmaraka backend so password reset and
 * verification emails work. Updates .env with Mailgun-related variables.
 *
 * Usage:
 *   node scripts/setup-email.js
 *     Interactive: prompts for Mailgun API key, domain, from, base URL, then writes .env.
 *
 *   MAILGUN_API_KEY=... MAILGUN_DOMAIN=... PASSWORD_RESET_BASE_URL=... node scripts/setup-email.js
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
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
  'MAILGUN_EU',
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
      if (key.startsWith('MAILGUN_') || key === 'MAIL_FROM' || key === 'PASSWORD_RESET_BASE_URL') hadEmailBlock = true;
      continue;
    }
    if (trimmed.startsWith('# Email') || trimmed.startsWith('# Base URL for password reset')) {
      hadEmailBlock = true;
    }
    out.push(line);
  }

  if (!hadEmailBlock && (envMap.MAILGUN_DOMAIN || envMap.PASSWORD_RESET_BASE_URL)) {
    out.push('');
    out.push('# Email (Mailgun)');
    out.push('PASSWORD_RESET_BASE_URL=' + (envMap.PASSWORD_RESET_BASE_URL || ''));
    out.push('MAIL_FROM=' + (envMap.MAIL_FROM || ''));
    out.push('MAILGUN_API_KEY=' + (envMap.MAILGUN_API_KEY || ''));
    out.push('MAILGUN_DOMAIN=' + (envMap.MAILGUN_DOMAIN || ''));
    out.push('MAILGUN_EU=' + (envMap.MAILGUN_EU || 'false'));
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

  console.log('Mmaraka – Email setup (Mailgun)\n');
  console.log('Values will be written to .env. Leave blank to keep existing or skip.\n');

  const MAILGUN_API_KEY = await prompt(rl, 'Mailgun API key', existing.MAILGUN_API_KEY);
  const MAILGUN_DOMAIN = await prompt(rl, 'Mailgun domain (e.g. sandboxxxx.mailgun.org)', existing.MAILGUN_DOMAIN);
  const PASSWORD_RESET_BASE_URL = await prompt(
    rl,
    'Password reset base URL (e.g. https://mmaraka.com – where users open the reset link)',
    existing.PASSWORD_RESET_BASE_URL || existing.BASE_URL || ''
  );
  const MAIL_FROM = await prompt(rl, '"From" email (e.g. Mmaraka <postmaster@your-domain.mailgun.org>)', existing.MAIL_FROM || '');
  const MAILGUN_EU = await prompt(rl, 'Mailgun EU region? (true/false)', existing.MAILGUN_EU || 'false');

  rl.close();

  return {
    ...existing,
    MAILGUN_API_KEY,
    MAILGUN_DOMAIN,
    PASSWORD_RESET_BASE_URL,
    MAIL_FROM,
    MAILGUN_EU: MAILGUN_EU === 'true' ? 'true' : 'false',
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
  const { sendEmail, isMailgunConfigured } = require('../src/lib/email');
  if (!isMailgunConfigured()) {
    console.error('Cannot send test: Mailgun not configured (MAILGUN_API_KEY and MAILGUN_DOMAIN required).');
    process.exit(1);
  }
  await sendEmail(toEmail, 'Mmaraka – Email test', 'If you received this, the Mmaraka server email setup is working.', '<p>If you received this, the Mmaraka server email setup is working.</p>');
  console.log('Test email sent to', toEmail);
}

async function main() {
  const args = process.argv.slice(2);
  const testEmail = args[0] === '--test' ? args[1] : null;

  const hasEnv = process.env.MAILGUN_API_KEY || process.env.MAILGUN_DOMAIN;
  const envMap = hasEnv ? runFromEnv() : await runInteractive();

  writeEnvMerged(envMap);
  console.log('Updated .env with email configuration.');

  if (envMap.MAILGUN_DOMAIN) {
    console.log('\nEmail config:');
    console.log('  MAILGUN_DOMAIN=', envMap.MAILGUN_DOMAIN);
    console.log('  MAIL_FROM=', envMap.MAIL_FROM || '(not set)');
    console.log('  PASSWORD_RESET_BASE_URL=', envMap.PASSWORD_RESET_BASE_URL || '(not set)');
    if (!envMap.PASSWORD_RESET_BASE_URL) {
      console.log('\nSet PASSWORD_RESET_BASE_URL to the web app URL (e.g. https://mmaraka.com) so reset links work.');
    }
  }

  if (testEmail) await sendTestEmail(testEmail);
}

main().catch((err) => {
  if (err.code === 'EACCES') {
    console.error('\n' + err.message);
    console.error('\nOn the server, either:');
    console.error('  1. Run as the user that owns .env (e.g. sudo -u www-data node scripts/setup-email.js)');
    console.error('  2. Or fix ownership: sudo chown $(whoami) backend/.env  then run the script again');
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
