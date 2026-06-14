/**
 * FreshTrack — Database Seed Script
 * Populates demo data for development and review
 * Run: node db/seed.js
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
  multipleStatements: true,
};

const SEED = `
-- Clear existing data
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE alert_rules;
TRUNCATE TABLE batches;
TRUNCATE TABLE products;
TRUNCATE TABLE stores;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Seed Store
INSERT INTO stores (id, shopify_domain, access_token, shop_name, email) VALUES
(1, 'verdantleafshop.myshopify.com', 'shpat_demo_token_xxxxx', 'Verdant Leaf', 'hello@verdantleaf.com');

-- 2. Seed Products
-- shopify_product_id values are the real product IDs in verdantleafshop,
-- so each FreshTrack product traces back to its live Shopify catalog entry.
INSERT INTO products (id, store_id, shopify_product_id, title, category, default_shelf_life_days) VALUES
(1, 1, 10248046149927, 'Uji Sencha Reserve', 'green_tea', 180),
(2, 1, 10248046117159, 'Golden Yunnan Tips', 'black_tea', 240),
(3, 1, 10248046051623, 'Ali Shan High Mountain', 'oolong', 210),
(4, 1, 10248045986087, 'Silver Needle Bai Hao', 'white_tea', 365),
(5, 1, 10248045953319, 'Ancient Tree Pu-erh', 'puerh', 730),
(6, 1, 10248045887783, 'Chamomile Meadow Blend', 'herbal', 365),
(7, 1, 10248045822247, 'Ceremonial Grade Matcha', 'matcha', 120),
(8, 1, 10248045789479, 'Dragon Pearl Jasmine', 'green_tea', 180),
(9, 1, 10248045691175, 'Darjeeling First Flush', 'black_tea', 240);

-- 3. Seed Batches (mix of statuses for a realistic dashboard)
INSERT INTO batches (id, product_id, lot_number, quantity, quantity_sold, manufactured_at, expires_at, freshness_score, status, supplier, notes) VALUES
-- Active batches (fresh)
(1,  1, 'VL-2026-042', 100, 12,  '2026-05-20', '2026-11-20', 92.50, 'active',   'Uji Tea Farm Co.',     'Spring first flush 2026'),
(2,  2, 'VL-2026-039', 75,  45,  '2026-04-15', '2026-12-15', 78.40, 'active',   'Yunnan Harvest Ltd.',  'Golden tips grade A'),
(3,  5, 'VL-2026-041', 50,  5,   '2026-05-01', '2028-05-01', 96.20, 'active',   'Ancient Forest Coop',  'Wild-grown, 200yr old trees'),
(4,  4, 'VL-2026-040', 30,  8,   '2026-04-01', '2027-04-01', 84.10, 'active',   'Fuding White Tea Co.', 'Premium bud-only pick'),
(5,  6, 'VL-2026-038', 60,  22,  '2026-03-10', '2027-03-10', 75.50, 'active',   'Egyptian Herb Gardens','Whole flower chamomile'),
(6,  8, 'VL-2026-043', 80,  3,   '2026-06-01', '2026-12-01', 95.80, 'active',   'Fujian Pearl Farm',   'Hand-rolled jasmine pearls'),
(7,  7, 'VL-2026-044', 40,  10,  '2026-05-25', '2026-09-25', 88.30, 'active',   'Uji Tea Farm Co.',    'Ceremonial grade, stone-ground'),
(17, 9, 'VL-2026-045', 55,  6,   '2026-05-28', '2027-01-28', 91.40, 'active',   'Darjeeling Estate',   'Spring first flush import'),

-- Warning batches (getting old)
(8,  3, 'VL-2026-031', 50,  30,  '2026-02-01', '2026-09-01', 41.20, 'warning',  'Ali Shan Collective',  'High mountain spring harvest'),
(9,  1, 'VL-2026-025', 60,  38,  '2026-01-15', '2026-07-30', 21.90, 'critical', 'Uji Tea Farm Co.',     'Autumn harvest 2025'),
(10, 2, 'VL-2026-029', 45,  32,  '2026-01-01', '2026-08-15', 34.50, 'warning',  'Yunnan Harvest Ltd.',  'Second flush batch'),

-- Critical batches (need urgent attention)
(11, 2, 'VL-2026-028', 60,  48,  '2025-12-10', '2026-06-20', 8.50,  'critical', 'Yunnan Harvest Ltd.',  'Approaching expiry'),
(12, 7, 'VL-2026-018', 30,  18,  '2026-01-01', '2026-06-15', 5.20,  'critical', 'Uji Tea Farm Co.',    'Matcha expires soon'),

-- Expired batches
(13, 9, 'VL-2026-015', 30,  18,  '2025-10-15', '2026-04-15', 0.00,  'expired',  'Darjeeling Estate',    'Older first flush, past prime'),
(14, 8, 'VL-2026-012', 25,  14,  '2025-09-01', '2026-03-01', 0.00,  'expired',  'Fujian Pearl Farm',   'Older batch, past prime'),

-- Sold out batches
(15, 1, 'VL-2026-019', 40,  40,  '2025-11-01', '2026-05-01', 0.00,  'sold_out', 'Uji Tea Farm Co.',    'Completely sold - great batch!'),
(16, 4, 'VL-2026-022', 20,  20,  '2025-12-01', '2026-12-01', 55.00, 'sold_out', 'Fuding White Tea Co.', 'Limited edition sold out');

-- 4. Seed Alert Rules
INSERT INTO alert_rules (id, store_id, name, threshold_score, action_type, action_config, is_active) VALUES
(1, 1, 'Low Freshness Warning',    30.00, 'email',    '{"email_to": "alerts@verdantleaf.com"}', 1),
(2, 1, 'Critical Stock Alert',     15.00, 'discount', '{"discount_percent": 15}', 1),
(3, 1, 'Near Expiry Emergency',     5.00, 'discount', '{"discount_percent": 30}', 1),
(4, 1, 'Slack Notification',       20.00, 'webhook',  '{"webhook_url": "https://hooks.slack.com/services/xxx/yyy/zzz"}', 0);

-- 5. Seed Activity Logs (realistic timeline)
INSERT INTO activity_logs (store_id, batch_id, action, description, metadata, created_at) VALUES
(1, 1,  'batch_created',    'New batch VL-2026-042 created (qty: 100, freshness: 98.5%)',                               '{"lotNumber":"VL-2026-042","quantity":100}',                              '2026-05-20 10:00:00'),
(1, 6,  'batch_created',    'New batch VL-2026-043 created (qty: 80, freshness: 99.1%)',                                '{"lotNumber":"VL-2026-043","quantity":80}',                               '2026-06-01 09:00:00'),
(1, 7,  'batch_created',    'New batch VL-2026-044 created (qty: 40, freshness: 97.2%)',                                '{"lotNumber":"VL-2026-044","quantity":40}',                               '2026-05-25 11:00:00'),
(1, 17, 'batch_created',    'New batch VL-2026-045 created (qty: 55, freshness: 96.8%)',                                '{"lotNumber":"VL-2026-045","quantity":55}',                               '2026-05-28 12:00:00'),
(1, 9,  'score_updated',    'Batch VL-2026-025: warning -> critical (score: 21.9)',                                      '{"oldStatus":"warning","newStatus":"critical","newScore":21.9}',          '2026-06-02 06:00:00'),
(1, 8,  'score_updated',    'Batch VL-2026-031: active → warning (score: 41.2)',                                        '{"oldStatus":"active","newStatus":"warning","newScore":41.2}',            '2026-05-28 06:00:00'),
(1, 11, 'score_updated',    'Batch VL-2026-028: warning → critical (score: 8.5)',                                       '{"oldStatus":"warning","newStatus":"critical","newScore":8.5}',           '2026-06-04 06:00:00'),
(1, 11, 'alert_triggered',  'Alert "Critical Stock Alert" triggered for batch VL-2026-028 (score: 8.5 < threshold: 15)','{"ruleId":2,"ruleName":"Critical Stock Alert","threshold":15,"score":8.5}','2026-06-04 06:00:01'),
(1, 11, 'discount_applied', 'Auto-discount of 15% applied to batch VL-2026-028',                                       '{"discount_percent":15,"ruleId":2}',                                     '2026-06-04 06:00:02'),
(1, 12, 'score_updated',    'Batch VL-2026-018: warning -> critical (score: 4.8)',                                      '{"oldStatus":"warning","newStatus":"critical","newScore":4.8}',           '2026-06-05 06:00:00'),
(1, 12, 'alert_triggered',  'Alert "Near Expiry Emergency" triggered for batch VL-2026-018 (score: 4.8 < threshold: 5)','{"ruleId":3,"ruleName":"Near Expiry Emergency","threshold":5,"score":4.8}','2026-06-05 06:00:01'),
(1, 12, 'discount_applied', 'Auto-discount of 30% applied to batch VL-2026-018',                                       '{"discount_percent":30,"ruleId":3}',                                     '2026-06-05 06:00:02'),
(1, 13, 'batch_expired',    'Batch VL-2026-015: critical → expired (score: 0.0)',                                       '{"oldStatus":"critical","newStatus":"expired","oldScore":3.2}',           '2026-04-15 00:00:00'),
(1, 15, 'batch_sold_out',   'Batch VL-2026-019 is sold out',                                                            '{"lotNumber":"VL-2026-019"}',                                            '2026-04-28 16:00:00'),
(1, NULL,'rule_created',    'Alert rule "Low Freshness Warning" created (threshold: 30%, action: email)',                '{"ruleId":1,"threshold":30,"actionType":"email"}',                        '2026-05-01 10:00:00'),
(1, NULL,'rule_created',    'Alert rule "Critical Stock Alert" created (threshold: 15%, action: discount)',              '{"ruleId":2,"threshold":15,"actionType":"discount"}',                     '2026-05-01 10:05:00'),
(1, NULL,'rule_created',    'Alert rule "Near Expiry Emergency" created (threshold: 5%, action: discount)',              '{"ruleId":3,"threshold":5,"actionType":"discount"}',                      '2026-05-15 08:00:00');
`;

async function seed() {
  console.log('FreshTrack - seeding database...\n');

  let connection;
  try {
    connection = await mysql.createConnection(config);
    await connection.query(SEED);
    console.log('Seed data inserted:');
    console.log('  - 1 store (Verdant Leaf)');
    console.log('  - 9 products');
    console.log('  - 17 batches (8 active, 2 warning, 3 critical, 2 expired, 2 sold out)');
    console.log('  - 4 alert rules');
    console.log('  - 17 activity log entries');
    console.log('\nSeeding complete.');
  } catch (error) {
    console.error('Seeding failed:', formatDbError(error));
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seed();
