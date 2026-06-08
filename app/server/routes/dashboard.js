/**
 * FreshTrack — Dashboard Routes
 * Aggregated analytics and metrics for the dashboard
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { batches, products, activityLogs } from '../db/schema.js';
import { eq, desc, count, and, inArray } from 'drizzle-orm';
import { recalculateAllBatches, getFreshnessDistribution, getWasteMetrics } from '../services/freshness.js';

const router = Router();

/**
 * GET /api/dashboard?storeId=1
 * Get complete dashboard data in one call
 */
router.get('/', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);

    // Recalculate all scores first
    const { updated, alerts } = await recalculateAllBatches(storeId);

    // Get freshness distribution
    const distribution = await getFreshnessDistribution(storeId);

    // Get waste metrics
    const waste = await getWasteMetrics(storeId);

    // Get recent activity (last 10)
    const recentActivity = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.storeId, storeId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(10);

    // Get batches at risk (warning + critical)
    const atRiskBatches = await db
      .select({
        id: batches.id,
        lotNumber: batches.lotNumber,
        freshnessScore: batches.freshnessScore,
        status: batches.status,
        expiresAt: batches.expiresAt,
        productTitle: products.title,
      })
      .from(batches)
      .innerJoin(products, eq(batches.productId, products.id))
      .where(and(
        eq(products.storeId, storeId),
        inArray(batches.status, ['warning', 'critical'])
      ))
      .orderBy(batches.freshnessScore)
      .limit(5);

    // Product count
    const productCount = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.storeId, storeId));

    res.json({
      metrics: {
        totalProducts: productCount[0]?.count || 0,
        totalBatches: waste.totalBatches,
        avgFreshness: waste.avgFreshness,
        wasteRate: waste.wasteRate,
        atRiskCount: waste.atRiskBatches,
        expiredCount: waste.expiredBatches,
        totalQuantity: waste.totalQuantity,
        totalSold: waste.totalSold,
        wastedQuantity: waste.wastedQuantity,
      },
      distribution,
      atRiskBatches,
      recentActivity: recentActivity.map(a => ({
        ...a,
        metadata: typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata,
      })),
      recalculation: { updated, alertsTriggered: alerts.length },
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * POST /api/dashboard/recalculate?storeId=1
 * Force recalculation of all batch freshness scores
 */
router.post('/recalculate', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);
    const result = await recalculateAllBatches(storeId);
    res.json({
      message: `Recalculated ${result.updated} batches`,
      ...result,
    });
  } catch (error) {
    console.error('Error recalculating:', error);
    res.status(500).json({ error: 'Failed to recalculate' });
  }
});

export default router;
