/**
 * FreshTrack — Activity Log Routes
 * Full audit trail with filtering
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { activityLogs, batches } from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/logs?storeId=1&limit=50&offset=0&action=alert_triggered&batchId=5
 * List activity logs with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const actionFilter = req.query.action;
    const batchIdFilter = req.query.batchId ? parseInt(req.query.batchId, 10) : null;

    const conditions = [eq(activityLogs.storeId, storeId)];

    if (actionFilter) {
      conditions.push(eq(activityLogs.action, actionFilter));
    }
    if (batchIdFilter) {
      conditions.push(eq(activityLogs.batchId, batchIdFilter));
    }

    const logs = await db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
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
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

export default router;
