/**
 * FreshTrack — Products Routes
 * Manage products linked to the store
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import {
  PRODUCT_CATEGORIES,
  requireEnum,
  respondWithError,
} from '../utils/validation.js';
import { syncProductsFromShopify } from '../services/productSync.js';

const router = Router();

/**
 * GET /api/products?storeId=1
 */
router.get('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    const result = await db.select()
      .from(products)
      .where(eq(products.storeId, storeId))
      .orderBy(desc(products.createdAt));
    res.json(result);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch products');
  }
});

/**
 * POST /api/products/sync?storeId=1
 * Pull the live Shopify catalog into FreshTrack (OAuth or custom-app token).
 */
router.post('/sync', async (req, res) => {
  try {
    const storeId = req.storeId;
    const summary = await syncProductsFromShopify(storeId);
    res.json(summary);
  } catch (error) {
    respondWithError(res, error, 'Failed to sync products from Shopify');
  }
});

/**
 * POST /api/products
 */
router.post('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    const { shopifyProductId, title, category, defaultShelfLifeDays } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing required field: title' });
    }
    if (category !== undefined) requireEnum(category, PRODUCT_CATEGORIES, 'category');

    const [result] = await db.insert(products).values({
      storeId,
      shopifyProductId: shopifyProductId || null,
      title,
      category: category || 'other',
      defaultShelfLifeDays: defaultShelfLifeDays || 180,
    });

    res.status(201).json({ id: result.insertId, message: 'Product created successfully' });
  } catch (error) {
    respondWithError(res, error, 'Failed to create product');
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { title, category, defaultShelfLifeDays, shopifyProductId } = req.body;

    const existing = await db.select().from(products)
      .where(and(eq(products.id, productId), eq(products.storeId, req.storeId)));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = requireEnum(category, PRODUCT_CATEGORIES, 'category');
    if (defaultShelfLifeDays !== undefined) updates.defaultShelfLifeDays = defaultShelfLifeDays;
    if (shopifyProductId !== undefined) updates.shopifyProductId = shopifyProductId;

    await db.update(products).set(updates).where(eq(products.id, productId));
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    respondWithError(res, error, 'Failed to update product');
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);

    const existing = await db.select().from(products)
      .where(and(eq(products.id, productId), eq(products.storeId, req.storeId)));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.delete(products).where(eq(products.id, productId));
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    respondWithError(res, error, 'Failed to delete product');
  }
});

export default router;
