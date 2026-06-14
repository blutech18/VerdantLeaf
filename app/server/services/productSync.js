/**
 * FreshTrack — Shopify product catalog sync
 *
 * Products are owned by Shopify (merchant adds/edits in admin).
 * FreshTrack mirrors the catalog so batches can be linked to real products.
 * Batches remain merchant-created in FreshTrack — Shopify has no lot/expiry data.
 */

import { db } from '../db/index.js';
import { products, batches, stores } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { calculateFreshness, logActivity } from './freshness.js';
import {
  fetchAllShopifyProducts,
  getStoreWithToken,
  inferCategory,
  SHELF_LIFE_BY_CATEGORY,
} from './shopify.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function mapShopifyProduct(shopifyProduct) {
  const category = inferCategory({
    product_type: shopifyProduct.product_type,
    tags: shopifyProduct.tags,
    title: shopifyProduct.title,
  });

  // Total on-hand stock = sum of variant inventory (real Shopify data).
  const variants = Array.isArray(shopifyProduct.variants) ? shopifyProduct.variants : [];
  const inventoryQuantity = variants.reduce(
    (sum, v) => sum + Math.max(0, Number(v.inventory_quantity) || 0),
    0
  );

  return {
    shopifyProductId: shopifyProduct.id,
    title: shopifyProduct.title,
    category,
    defaultShelfLifeDays: SHELF_LIFE_BY_CATEGORY[category] || 180,
    inventoryQuantity,
    vendor: shopifyProduct.vendor || null,
  };
}

/**
 * Auto-batch model: every Shopify product is mirrored as exactly one tracking
 * batch so the Batch Management table stays in sync with the catalog without
 * manual entry.
 *
 * - Quantity comes from live Shopify inventory.
 * - Expiry is seeded from the category's default shelf life on first create,
 *   then preserved so a merchant can edit it to the real date (the one piece
 *   of data Shopify cannot provide).
 */
function autoLotNumber(shopifyProductId) {
  return `SHFY-${String(shopifyProductId).slice(-8)}`;
}

async function ensureProductBatch(storeId, productId, mapped) {
  const existing = await db
    .select()
    .from(batches)
    .where(eq(batches.productId, productId))
    .limit(1);

  const quantity = mapped.inventoryQuantity ?? 0;

  if (existing.length === 0) {
    const manufacturedAt = new Date();
    const expiresAt = new Date(manufacturedAt.getTime() + (mapped.defaultShelfLifeDays || 180) * DAY_MS);
    const { score, status } = calculateFreshness(manufacturedAt, expiresAt);

    await db.insert(batches).values({
      productId,
      lotNumber: autoLotNumber(mapped.shopifyProductId),
      quantity,
      quantitySold: 0,
      manufacturedAt,
      expiresAt,
      freshnessScore: score.toFixed(2),
      status: quantity === 0 ? 'sold_out' : status,
      supplier: mapped.vendor,
      notes: 'Auto-created from Shopify catalog. Edit to set the real expiry date.',
    });

    await logActivity(storeId, null, 'batch_created',
      `Auto-created batch for "${mapped.title}" from Shopify (stock: ${quantity})`,
      { type: 'auto_batch', shopifyProductId: mapped.shopifyProductId, quantity }
    );
    return { action: 'created' };
  }

  // Keep stock in sync with Shopify; preserve merchant-edited dates/lot/supplier.
  const batch = existing[0];
  if (batch.quantity !== quantity) {
    const { score, status } = calculateFreshness(batch.manufacturedAt, batch.expiresAt);
    const soldOut = quantity === 0 || (quantity > 0 && batch.quantitySold >= quantity);
    await db.update(batches)
      .set({ quantity, freshnessScore: score.toFixed(2), status: soldOut ? 'sold_out' : status })
      .where(eq(batches.id, batch.id));
  }
  return { action: 'synced' };
}

/**
 * Upsert a single Shopify product into FreshTrack.
 */
export async function upsertShopifyProduct(storeId, shopifyProduct) {
  const mapped = mapShopifyProduct(shopifyProduct);

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(
      eq(products.storeId, storeId),
      eq(products.shopifyProductId, mapped.shopifyProductId)
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(products)
      .set({
        title: mapped.title,
        category: mapped.category,
        defaultShelfLifeDays: mapped.defaultShelfLifeDays,
      })
      .where(eq(products.id, existing[0].id));
    await ensureProductBatch(storeId, existing[0].id, mapped);
    return { action: 'updated', productId: existing[0].id, ...mapped };
  }

  const [result] = await db.insert(products).values({
    storeId,
    shopifyProductId: mapped.shopifyProductId,
    title: mapped.title,
    category: mapped.category,
    defaultShelfLifeDays: mapped.defaultShelfLifeDays,
  });

  await ensureProductBatch(storeId, result.insertId, mapped);
  return { action: 'created', productId: result.insertId, ...mapped };
}

/**
 * Remove a Shopify product from FreshTrack when safe (no batches attached).
 */
export async function removeShopifyProduct(storeId, shopifyProductId) {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(
      eq(products.storeId, storeId),
      eq(products.shopifyProductId, shopifyProductId)
    ))
    .limit(1);

  if (existing.length === 0) return { action: 'missing' };

  const linkedBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(eq(batches.productId, existing[0].id))
    .limit(1);

  if (linkedBatches.length > 0) {
    return { action: 'kept', reason: 'has_batches', productId: existing[0].id };
  }

  await db.delete(products).where(eq(products.id, existing[0].id));
  return { action: 'removed', productId: existing[0].id };
}

/**
 * Full catalog sync from Shopify Admin API.
 */
export async function syncProductsFromShopify(storeId) {
  const store = await getStoreWithToken(storeId);
  const shopifyProducts = await fetchAllShopifyProducts(store);

  let created = 0;
  let updated = 0;
  const shopifyIds = [];

  for (const shopifyProduct of shopifyProducts) {
    const result = await upsertShopifyProduct(storeId, shopifyProduct);
    shopifyIds.push(shopifyProduct.id);
    if (result.action === 'created') created += 1;
    if (result.action === 'updated') updated += 1;
  }

  // Remove FreshTrack-only products that no longer exist in Shopify (if no batches)
  let removed = 0;
  let kept = 0;
  const localProducts = await db
    .select({ id: products.id, shopifyProductId: products.shopifyProductId })
    .from(products)
    .where(eq(products.storeId, storeId));

  for (const local of localProducts) {
    if (!local.shopifyProductId || shopifyIds.includes(local.shopifyProductId)) continue;
    const result = await removeShopifyProduct(storeId, local.shopifyProductId);
    if (result.action === 'removed') removed += 1;
    if (result.action === 'kept') kept += 1;
  }

  const summary = {
    syncedAt: new Date().toISOString(),
    shop: store.shopifyDomain,
    tokenSource: store.tokenSource,
    total: shopifyProducts.length,
    created,
    updated,
    removed,
    keptWithBatches: kept,
  };

  await logActivity(
    storeId,
    null,
    'batch_updated',
    `Synced ${shopifyProducts.length} products from Shopify (${created} new, ${updated} updated)`,
    { type: 'product_sync', ...summary }
  );

  return summary;
}

/**
 * Resolve store ID from shop domain (webhooks / embedded context).
 */
export async function getStoreIdByDomain(shopDomain) {
  const rows = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.shopifyDomain, shopDomain))
    .limit(1);
  return rows[0]?.id || null;
}
