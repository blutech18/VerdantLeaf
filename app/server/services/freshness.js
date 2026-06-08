/**
 * FreshTrack — Freshness Scoring Engine
 * 
 * Core business logic that calculates and updates freshness scores for all batches.
 * The score is a time-decaying metric: score = (days_remaining / total_shelf_life) × 100
 * 
 * Status thresholds:
 *   score >= 60  → "active"    (green)
 *   score >= 30  → "warning"   (amber)
 *   score > 0    → "critical"  (red)
 *   score <= 0   → "expired"   (dark)
 *   quantity_sold >= quantity → "sold_out"
 */

import { db } from '../db/index.js';
import { batches, products, activityLogs, alertRules } from '../db/schema.js';
import { eq, and, ne, gte } from 'drizzle-orm';

/**
 * Calculate freshness score for a single batch
 * @param {Date} manufacturedAt 
 * @param {Date} expiresAt 
 * @returns {{ score: number, status: string }}
 */
export function calculateFreshness(manufacturedAt, expiresAt) {
  const now = new Date();
  const mfg = new Date(manufacturedAt);
  const exp = new Date(expiresAt);

  const totalShelfLife = (exp - mfg) / (1000 * 60 * 60 * 24); // in days
  const daysRemaining = (exp - now) / (1000 * 60 * 60 * 24);   // in days

  if (totalShelfLife <= 0) return { score: 0, status: 'expired' };

  const score = Math.max(0, Math.min(100, (daysRemaining / totalShelfLife) * 100));
  const roundedScore = Math.round(score * 100) / 100;

  let status;
  if (roundedScore <= 0) {
    status = 'expired';
  } else if (roundedScore < 30) {
    status = 'critical';
  } else if (roundedScore < 60) {
    status = 'warning';
  } else {
    status = 'active';
  }

  return { score: roundedScore, status };
}

/**
 * Recalculate freshness scores for all active batches of a store.
 * This is the core scheduled operation.
 * 
 * @param {number} storeId 
 * @returns {{ updated: number, alerts: Array }} 
 */
export async function recalculateAllBatches(storeId) {
  const activeBatches = await db
    .select({
      id: batches.id,
      productId: batches.productId,
      lotNumber: batches.lotNumber,
      quantity: batches.quantity,
      quantitySold: batches.quantitySold,
      manufacturedAt: batches.manufacturedAt,
      expiresAt: batches.expiresAt,
      freshnessScore: batches.freshnessScore,
      status: batches.status,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .where(
      and(
        eq(products.storeId, storeId),
        ne(batches.status, 'sold_out')
      )
    );

  let updated = 0;
  const alerts = [];

  for (const batch of activeBatches) {
    // Check sold out
    if (batch.quantitySold >= batch.quantity && batch.quantity > 0) {
      await db.update(batches)
        .set({ status: 'sold_out', freshnessScore: batch.freshnessScore })
        .where(eq(batches.id, batch.id));

      await logActivity(storeId, batch.id, 'batch_sold_out', 
        `Batch ${batch.lotNumber} is sold out`, { lotNumber: batch.lotNumber });
      updated++;
      continue;
    }

    const { score, status } = calculateFreshness(batch.manufacturedAt, batch.expiresAt);
    const oldStatus = batch.status;
    const oldScore = parseFloat(batch.freshnessScore || '100');

    // Only update if score actually changed
    if (Math.abs(oldScore - score) >= 0.01 || oldStatus !== status) {
      await db.update(batches)
        .set({ freshnessScore: score.toFixed(2), status })
        .where(eq(batches.id, batch.id));

      updated++;

      if (oldStatus !== status) {
        const actionType = status === 'expired' ? 'batch_expired' : 'score_updated';
        await logActivity(storeId, batch.id, actionType,
          `Batch ${batch.lotNumber}: ${oldStatus} → ${status} (score: ${score.toFixed(1)})`,
          { oldStatus, newStatus: status, oldScore, newScore: score }
        );
      }

      const triggeredAlerts = await evaluateAlertRules(storeId, batch, score, oldScore);
      alerts.push(...triggeredAlerts);
    }
  }

  return { updated, alerts };
}

/**
 * Evaluate alert rules against a batch's new freshness score
 */
async function evaluateAlertRules(storeId, batch, newScore, oldScore) {
  const rules = await db.select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.storeId, storeId),
        eq(alertRules.isActive, true),
        gte(alertRules.thresholdScore, newScore.toFixed(2))
      )
    );

  const triggered = [];

  for (const rule of rules) {
    const threshold = parseFloat(rule.thresholdScore);

    // Only trigger if score just crossed below threshold (wasn't already below)
    if (oldScore > threshold && newScore <= threshold) {
      triggered.push({
        ruleId: rule.id,
        ruleName: rule.name,
        batchId: batch.id,
        lotNumber: batch.lotNumber,
        actionType: rule.actionType,
        actionConfig: rule.actionConfig,
        score: newScore,
      });

      await logActivity(storeId, batch.id, 'alert_triggered',
        `Alert "${rule.name}" triggered for batch ${batch.lotNumber} (score: ${newScore.toFixed(1)} < threshold: ${threshold})`,
        { ruleId: rule.id, ruleName: rule.name, threshold, score: newScore, actionType: rule.actionType }
      );

      // Execute action
      if (rule.actionType === 'discount' && rule.actionConfig) {
        const config = typeof rule.actionConfig === 'string' ? JSON.parse(rule.actionConfig) : rule.actionConfig;
        await logActivity(storeId, batch.id, 'discount_applied',
          `Auto-discount of ${config.discount_percent || 0}% applied to batch ${batch.lotNumber}`,
          { discount_percent: config.discount_percent, ruleId: rule.id }
        );
      }
    }
  }

  return triggered;
}

/**
 * Log an activity
 */
async function logActivity(storeId, batchId, action, description, metadata = {}) {
  await db.insert(activityLogs).values({
    storeId,
    batchId,
    action,
    description,
    metadata: JSON.stringify(metadata),
  });
}

/**
 * Get freshness distribution for dashboard
 * @param {number} storeId
 * @returns {{ active: number, warning: number, critical: number, expired: number, soldOut: number }}
 */
export async function getFreshnessDistribution(storeId) {
  const allBatches = await db
    .select({ status: batches.status })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .where(eq(products.storeId, storeId));

  const dist = { active: 0, warning: 0, critical: 0, expired: 0, sold_out: 0 };
  allBatches.forEach(b => {
    if (dist.hasOwnProperty(b.status)) dist[b.status]++;
  });

  return dist;
}

/**
 * Get waste metrics for dashboard
 * @param {number} storeId
 */
export async function getWasteMetrics(storeId) {
  const allBatches = await db
    .select({
      status: batches.status,
      quantity: batches.quantity,
      quantitySold: batches.quantitySold,
      freshnessScore: batches.freshnessScore,
    })
    .from(batches)
    .innerJoin(products, eq(batches.productId, products.id))
    .where(eq(products.storeId, storeId));

  const totalBatches = allBatches.length;
  const expiredBatches = allBatches.filter(b => b.status === 'expired').length;
  const atRiskBatches = allBatches.filter(b => b.status === 'warning' || b.status === 'critical').length;

  const totalQuantity = allBatches.reduce((sum, b) => sum + b.quantity, 0);
  const totalSold = allBatches.reduce((sum, b) => sum + b.quantitySold, 0);
  const wastedQuantity = allBatches
    .filter(b => b.status === 'expired')
    .reduce((sum, b) => sum + (b.quantity - b.quantitySold), 0);

  const avgFreshness = totalBatches > 0
    ? allBatches.reduce((sum, b) => sum + parseFloat(b.freshnessScore || 0), 0) / totalBatches
    : 0;

  return {
    totalBatches,
    expiredBatches,
    atRiskBatches,
    wasteRate: totalQuantity > 0 ? ((wastedQuantity / totalQuantity) * 100).toFixed(1) : '0.0',
    avgFreshness: avgFreshness.toFixed(1),
    totalQuantity,
    totalSold,
    wastedQuantity,
  };
}

export { logActivity };
