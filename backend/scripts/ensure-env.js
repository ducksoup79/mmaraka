#!/usr/bin/env node
// Ensures .env exists (copy from .env.example) so the server can start locally.
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('Created .env from .env.example.');
  console.log('Edit .env and set DB_PASSWORD and JWT_SECRET (and REFRESH_TOKEN_SECRET), then run:');
  console.log('  npm run setup   # first time only (creates DB and seed data)');
  console.log('  npm run dev     # start the server');
  process.exit(1);
}
