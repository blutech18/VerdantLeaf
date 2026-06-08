/**
 * FreshTrack — Products Routes
 * Manage products linked to the store
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/products?storeId=1
 */
router.get('/', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);
    const result = await db.select()
      .from(products)
      .where(eq(products.storeId, storeId))
      .orderBy(desc(products.createdAt));
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * POST /api/products
 */
router.post('/', async (req, res) => {
  try {
    const { storeId, shopifyProductId, title, category, defaultShelfLifeDays } = req.body;

    if (!storeId || !title) {
      return res.status(400).json({ error: 'Missing required fields: storeId, title' });
    }

    const [result] = await db.insert(products).values({
      storeId,
      shopifyProductId: shopifyProductId || null,
      title,
      category: category || 'other',
      defaultShelfLifeDays: defaultShelfLifeDays || 180,
    });

    res.status(201).json({ id: result.insertId, message: 'Product created successfully' });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const { title, category, defaultShelfLifeDays, shopifyProductId } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (category !== undefined) updates.category = category;
    if (defaultShelfLifeDays !== undefined) updates.defaultShelfLifeDays = defaultShelfLifeDays;
    if (shopifyProductId !== undefined) updates.shopifyProductId = shopifyProductId;

    await db.update(products).set(updates).where(eq(products.id, productId));
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(products).where(eq(products.id, parseInt(req.params.id, 10)));
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
