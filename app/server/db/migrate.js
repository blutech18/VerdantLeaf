/**
 * FreshTrack database migration runner.
 * Run from app/server with: npm run migrate
 */

import '../config/env.js';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { formatDbError } from './error.js';

const DB_NAME = process.env.DB_NAME || 'freshtrack';
const migrationSql = readFileSync(new URL('./migrations/0000_initial_schema.sql', import.meta.url), 'utf8')
  .replaceAll('{{DB_NAME}}', DB_NAME);

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

async function migrate() {
  console.log('FreshTrack - running migrations...\n');

  let connection;
  try {
    connection = await mysql.createConnection(config);
    await connection.query(migrationSql);
    console.log('All tables created successfully:');
    console.log('  - stores');
    console.log('  - products');
    console.log('  - batches');
    console.log('  - alert_rules');
    console.log('  - activity_logs');
    console.log('\nMigration complete.');
  } catch (error) {
    console.error('Migration failed:', formatDbError(error));
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
