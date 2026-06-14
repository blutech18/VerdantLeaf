/**
 * FreshTrack — Link products to real Shopify product IDs
 *
 * Idempotent maintenance script. Updates each product's shopify_product_id to
 * the real ID in the connected store (matched by title) so batches can be
 * traced back to the live Shopify catalog without wiping existing data.
 *
 * Run: node db/link-shopify-products.js
 */

import '../config/env.js';
import mysql from 'mysql2/promise';
import { formatDbError } from './error.js';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'freshtrack',
};

// Real Shopify product IDs for verdantleafshop, keyed by product title.
const PRODUCT_ID_BY_TITLE = {
  'Uji Sencha Reserve': 10248046149927,
  'Golden Yunnan Tips': 10248046117159,
  'Ali Shan High Mountain': 10248046051623,
  'Silver Needle Bai Hao': 10248045986087,
  'Ancient Tree Pu-erh': 10248045953319,
  'Chamomile Meadow Blend': 10248045887783,
  'Ceremonial Grade Matcha': 10248045822247,
  'Dragon Pearl Jasmine': 10248045789479,
  'Darjeeling First Flush': 10248045691175,
};

async function link() {
  console.log('FreshTrack - linking products to real Shopify IDs...\n');
  let conn;
  try {
    conn = await mysql.createConnection(config);
    let updated = 0;
    for (const [title, shopifyProductId] of Object.entries(PRODUCT_ID_BY_TITLE)) {
      const [result] = await conn.execute(
        'UPDATE products SET shopify_product_id = ? WHERE title = ?',
        [shopifyProductId, title]
      );
      const matched = result.affectedRows > 0;
      updated += matched ? 1 : 0;
      console.log(`  ${matched ? '✓' : '–'} ${title} → ${shopifyProductId}${matched ? '' : ' (no matching product)'}`);
    }
    console.log(`\nDone. ${updated}/${Object.keys(PRODUCT_ID_BY_TITLE).length} products linked.`);
  } catch (error) {
    console.error('\nFailed to link products:\n' + formatDbError(error));
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

link();
