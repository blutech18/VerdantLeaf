/**
 * FreshTrack — Drizzle ORM Schema
 * 
 * 5 related tables:
 * 1. stores — Shopify store installations
 * 2. products — Products linked to Shopify
 * 3. batches — Inventory batches with expiry tracking
 * 4. alert_rules — Configurable freshness alert thresholds
 * 5. activity_logs — Full audit trail
 */

import { mysqlTable, int, bigint, varchar, text, decimal, boolean, date, timestamp, mysqlEnum, json } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ============================================
// 1. STORES
// ============================================
export const stores = mysqlTable('stores', {
  id: int('id').primaryKey().autoincrement(),
  shopifyDomain: varchar('shopify_domain', { length: 255 }).notNull().unique(),
  accessToken: varchar('access_token', { length: 255 }).notNull(),
  shopName: varchar('shop_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const storesRelations = relations(stores, ({ many }) => ({
  products: many(products),
  alertRules: many(alertRules),
  activityLogs: many(activityLogs),
}));

// ============================================
// 2. PRODUCTS
// ============================================
export const products = mysqlTable('products', {
  id: int('id').primaryKey().autoincrement(),
  storeId: int('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  shopifyProductId: bigint('shopify_product_id', { mode: 'number' }),
  title: varchar('title', { length: 255 }).notNull(),
  category: mysqlEnum('category', [
    'green_tea', 'black_tea', 'oolong', 'white_tea',
    'puerh', 'herbal', 'matcha', 'other'
  ]).default('other'),
  defaultShelfLifeDays: int('default_shelf_life_days').default(180),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  batches: many(batches),
}));

// ============================================
// 3. BATCHES
// ============================================
export const batches = mysqlTable('batches', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  lotNumber: varchar('lot_number', { length: 100 }).notNull(),
  quantity: int('quantity').notNull().default(0),
  quantitySold: int('quantity_sold').notNull().default(0),
  manufacturedAt: date('manufactured_at').notNull(),
  expiresAt: date('expires_at').notNull(),
  freshnessScore: decimal('freshness_score', { precision: 5, scale: 2 }).default('100.00'),
  status: mysqlEnum('status', [
    'active', 'warning', 'critical', 'expired', 'sold_out'
  ]).default('active'),
  supplier: varchar('supplier', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  activityLogs: many(activityLogs),
}));

// ============================================
// 4. ALERT RULES
// ============================================
export const alertRules = mysqlTable('alert_rules', {
  id: int('id').primaryKey().autoincrement(),
  storeId: int('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  thresholdScore: decimal('threshold_score', { precision: 5, scale: 2 }).notNull(),
  actionType: mysqlEnum('action_type', ['discount', 'email', 'webhook']).notNull(),
  actionConfig: json('action_config'),  // { discount_percent, email_to, webhook_url }
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
  store: one(stores, {
    fields: [alertRules.storeId],
    references: [stores.id],
  }),
}));

// ============================================
// 5. ACTIVITY LOGS
// ============================================
export const activityLogs = mysqlTable('activity_logs', {
  id: int('id').primaryKey().autoincrement(),
  storeId: int('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
  batchId: int('batch_id').references(() => batches.id, { onDelete: 'set null' }),
  action: mysqlEnum('action', [
    'batch_created', 'batch_updated', 'score_updated',
    'alert_triggered', 'discount_applied', 'batch_expired',
    'batch_sold_out', 'rule_created', 'rule_updated', 'rule_deleted'
  ]).notNull(),
  description: text('description'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  store: one(stores, {
    fields: [activityLogs.storeId],
    references: [stores.id],
  }),
  batch: one(batches, {
    fields: [activityLogs.batchId],
    references: [batches.id],
  }),
}));
