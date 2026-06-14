/**
 * FreshTrack — Activity Log Routes
 * Full audit trail with filtering
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { activityLogs } from '../db/schema.js';
import { eq, desc, asc, and, sql, gte, lte, ilike, or } from 'drizzle-orm';
import { respondWithError } from '../utils/validation.js';
import { resolveStore } from '../utils/sessionAuth.js';

const router = Router();

// Storefront events are recorded as `batch_updated` with an `isAddToCart`
// flag in metadata, which the admin UI renders as "Added to cart".
const STOREFRONT_ACTIONS = new Set(['batch_updated']);

/**
 * GET /api/logs?storeId=1&limit=50&offset=0&action=alert_triggered&batchId=5
 * List activity logs with optional filters
 */
router.get('/', resolveStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const actionFilter = req.query.action;
    const batchIdFilter = req.query.batchId ? parseInt(req.query.batchId, 10) : null;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search;
    const sortDir = req.query.sortDir === 'asc' ? asc : desc;

    const conditions = [eq(activityLogs.storeId, storeId)];

    if (actionFilter) {
      conditions.push(eq(activityLogs.action, actionFilter));
    }
    if (batchIdFilter) {
      conditions.push(eq(activityLogs.batchId, batchIdFilter));
    }
    if (startDate) {
      // Compare only the date part (ignore time) - startDate format is YYYY-MM-DD
      conditions.push(sql`DATE(${activityLogs.createdAt}) >= ${startDate}`);
    }
    if (endDate) {
      // Compare only the date part (ignore time) - endDate format is YYYY-MM-DD
      conditions.push(sql`DATE(${activityLogs.createdAt}) <= ${endDate}`);
    }
    if (search) {
      conditions.push(
        or(
          ilike(activityLogs.description, `%${search}%`),
          ilike(activityLogs.action, `%${search}%`)
        )
      );
    }

    const logs = await db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(sortDir(activityLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql`COUNT(*)`.as('count') })
      .from(activityLogs)
      .where(and(...conditions));

    res.json({
      logs: logs.map(l => ({
        ...l,
        metadata: typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata,
      })),
      total: totalResult[0]?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch activity logs');
  }
});

/**
 * POST /api/logs/track
 * Generic tracking endpoint for storefront events (e.g. Add to Cart)
 */
router.post('/track', async (req, res) => {
  try {
    const { storeId, action, description, metadata } = req.body;
    const safeAction = STOREFRONT_ACTIONS.has(action) ? action : 'batch_updated';

    await db.insert(activityLogs).values({
      storeId: parseInt(storeId || '1', 10),
      action: safeAction,
      description: description || 'Storefront action recorded',
      metadata: metadata || {},
    });
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error, 'Failed to track event');
  }
});

export default router;
