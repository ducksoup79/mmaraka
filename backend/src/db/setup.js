require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'marketplace';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function run() {
  const tempClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await tempClient.connect();
    const res = await tempClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [DB_NAME]
    );
    if (res.rows.length === 0) {
      await tempClient.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`Database "${DB_NAME}" created.`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.error('Failed to create database:', err.message);
    process.exit(1);
  } finally {
    await tempClient.end();
  }

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    await client.connect();

    const schemaPath = path.join(__dirname, '../../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const seedPath = path.join(__dirname, '../../seed.sql');
    let seed = fs.readFileSync(seedPath, 'utf8');
    seed = seed.replace(/\$ADMIN_PASSWORD_HASH\$/g, adminHash);
    await client.query(seed);
    console.log('Seed data inserted (admin password from ADMIN_PASSWORD).');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  console.log('Setup complete. Run: npm run dev');
}

run();
