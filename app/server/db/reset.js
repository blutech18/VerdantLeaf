/**
 * FreshTrack — Reset operational data
 *
 * Clears batches, activity logs, and alert rules so the app can repopulate
 * from real Shopify data on the next sync. Stores and products are kept.
 *
 * Usage:  npm run reset
 */

import '../config/env.js';
import { pool } from './index.js';

async function reset() {
  const conn = await pool.getConnection();
  try {
    // Order matters: activity_logs references batches; delete children first.
    await conn.query('DELETE FROM activity_logs');
    await conn.query('DELETE FROM batches');
    await conn.query('DELETE FROM alert_rules');
    console.log('Cleared batches, activity_logs, and alert_rules.');
    console.log('Products and stores were kept. Open the app and click "Sync from Shopify" to repopulate batches from your live catalog.');
  } finally {
    conn.release();
    await pool.end();
  }
}

reset().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
