/**
 * FreshTrack — Batch Management Routes
 * CRUD operations + freshness score calculation
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { batches, products } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { calculateFreshness, logActivity } from '../services/freshness.js';

const router = Router();

/**
 * GET /api/batches?storeId=1
 * List all batches for a store (with product info)
 */
router.get('/', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);

    const result = await db
      .select({
        id: batches.id,
        lotNumber: batches.lotNumber,
        quantity: batches.quantity,
        quantitySold: batches.quantitySold,
        manufacturedAt: batches.manufacturedAt,
        expiresAt: batches.expiresAt,
        freshnessScore: batches.freshnessScore,
        status: batches.status,
        supplier: batches.supplier,
        notes: batches.notes,
        createdAt: batches.createdAt,
        productId: batches.productId,
        productTitle: products.title,
        productCategory: products.category,
      })
      .from(batches)
      .innerJoin(products, eq(batches.productId, products.id))
      .where(eq(products.storeId, storeId))
      .orderBy(desc(batches.createdAt));

    // Recalculate freshness scores on read for accuracy
    const enriched = result.map(batch => {
      const { score, status } = calculateFreshness(batch.manufacturedAt, batch.expiresAt);
      return {
        ...batch,
        freshnessScore: batch.quantitySold >= batch.quantity && batch.quantity > 0
          ? parseFloat(batch.freshnessScore)
          : score,
        status: batch.quantitySold >= batch.quantity && batch.quantity > 0
          ? 'sold_out'
          : status,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

/**
 * GET /api/batches/:id
 * Get a single batch by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db
      .select({
        id: batches.id,
        lotNumber: batches.lotNumber,
        quantity: batches.quantity,
        quantitySold: batches.quantitySold,
        manufacturedAt: batches.manufacturedAt,
        expiresAt: batches.expiresAt,
        freshnessScore: batches.freshnessScore,
        status: batches.status,
        supplier: batches.supplier,
        notes: batches.notes,
        productId: batches.productId,
        productTitle: products.title,
        productCategory: products.category,
      })
      .from(batches)
      .innerJoin(products, eq(batches.productId, products.id))
      .where(eq(batches.id, parseInt(req.params.id, 10)));

    if (result.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = result[0];
    const { score, status } = calculateFreshness(batch.manufacturedAt, batch.expiresAt);

    res.json({ ...batch, freshnessScore: score, status });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

/**
 * POST /api/batches
 * Create a new batch
 */
router.post('/', async (req, res) => {
  try {
    const { productId, lotNumber, quantity, manufacturedAt, expiresAt, supplier, notes } = req.body;

    if (!productId || !lotNumber || !quantity || !manufacturedAt || !expiresAt) {
      return res.status(400).json({ error: 'Missing required fields: productId, lotNumber, quantity, manufacturedAt, expiresAt' });
    }

    const { score, status } = calculateFreshness(manufacturedAt, expiresAt);

    const [result] = await db.insert(batches).values({
      productId: parseInt(productId, 10),
      lotNumber,
      quantity: parseInt(quantity),
      manufacturedAt: new Date(manufacturedAt),
      expiresAt: new Date(expiresAt),
      freshnessScore: score.toFixed(2),
      status,
      supplier: supplier || null,
      notes: notes || null,
    });

    // Get store ID for logging
    const product = await db.select().from(products).where(eq(products.id, parseInt(productId, 10)));
    if (product.length > 0) {
      await logActivity(product[0].storeId, result.insertId, 'batch_created',
        `New batch ${lotNumber} created (qty: ${quantity}, freshness: ${score.toFixed(1)}%)`,
        { lotNumber, quantity, freshnessScore: score }
      );
    }

    res.status(201).json({
      id: result.insertId,
      lotNumber,
      quantity,
      freshnessScore: score,
      status,
      message: 'Batch created successfully',
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

/**
 * PUT /api/batches/:id
 * Update a batch
 */
router.put('/:id', async (req, res) => {
  try {
    const batchId = parseInt(req.params.id, 10);
    const { lotNumber, quantity, quantitySold, manufacturedAt, expiresAt, supplier, notes } = req.body;

    const existing = await db.select().from(batches).where(eq(batches.id, batchId));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const updates = {};
    if (lotNumber !== undefined) updates.lotNumber = lotNumber;
    if (quantity !== undefined) updates.quantity = parseInt(quantity);
    if (quantitySold !== undefined) updates.quantitySold = parseInt(quantitySold);
    if (supplier !== undefined) updates.supplier = supplier;
    if (notes !== undefined) updates.notes = notes;

    if (manufacturedAt) updates.manufacturedAt = new Date(manufacturedAt);
    if (expiresAt) updates.expiresAt = new Date(expiresAt);

    // Recalculate freshness if dates changed
    if (manufacturedAt || expiresAt) {
      const mfg = manufacturedAt || existing[0].manufacturedAt;
      const exp = expiresAt || existing[0].expiresAt;
      const { score, status } = calculateFreshness(mfg, exp);
      updates.freshnessScore = score.toFixed(2);
      updates.status = status;
    }

    // Check for sold_out
    const nextQuantity = updates.quantity ?? existing[0].quantity;
    const nextQuantitySold = updates.quantitySold ?? existing[0].quantitySold;
    if (nextQuantity > 0 && nextQuantitySold >= nextQuantity) {
      updates.status = 'sold_out';
    } else if (quantity !== undefined || quantitySold !== undefined) {
      const { score, status } = calculateFreshness(
        updates.manufacturedAt || existing[0].manufacturedAt,
        updates.expiresAt || existing[0].expiresAt
      );
      updates.freshnessScore = score.toFixed(2);
      updates.status = status;
    }

    await db.update(batches).set(updates).where(eq(batches.id, batchId));

    // Log the update
    const batch = await db.select().from(batches).where(eq(batches.id, batchId));
    if (batch.length > 0) {
      const product = await db.select().from(products).where(eq(products.id, batch[0].productId));
      if (product.length > 0) {
        await logActivity(product[0].storeId, batchId, 'batch_updated',
          `Batch ${batch[0].lotNumber} updated`,
          { updates: Object.keys(updates) }
        );
      }
    }

    res.json({ message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

/**
 * DELETE /api/batches/:id
 * Delete a batch
 */
router.delete('/:id', async (req, res) => {
  try {
    const batchId = parseInt(req.params.id, 10);
    await db.delete(batches).where(eq(batches.id, batchId));
    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

export default router;
