/**
 * FreshTrack — Alert Rules Routes
 * CRUD for configurable freshness alert rules
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { alertRules } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { logActivity } from '../services/freshness.js';
import {
  ACTION_TYPES,
  requireEnum,
  requireThreshold,
  respondWithError,
} from '../utils/validation.js';

const router = Router();

/**
 * GET /api/alerts?storeId=1
 * List all alert rules for a store
 */
router.get('/', async (req, res) => {
  try {
    const storeId = req.storeId;

    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.storeId, storeId))
      .orderBy(desc(alertRules.thresholdScore));

    res.json(rules);
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch alert rules');
  }
});

/**
 * POST /api/alerts
 * Create a new alert rule
 */
router.post('/', async (req, res) => {
  try {
    const storeId = req.storeId;
    const { name, thresholdScore, actionType, actionConfig } = req.body;

    if (!name || thresholdScore === undefined || !actionType) {
      return res.status(400).json({ error: 'Missing required fields: name, thresholdScore, actionType' });
    }

    requireEnum(actionType, ACTION_TYPES, 'actionType');
    const threshold = requireThreshold(thresholdScore);

    const [result] = await db.insert(alertRules).values({
      storeId,
      name,
      thresholdScore: threshold.toFixed(2),
      actionType,
      actionConfig: actionConfig || null,
      isActive: true,
    });

    await logActivity(storeId, null, 'rule_created',
      `Alert rule "${name}" created (threshold: ${threshold}%, action: ${actionType})`,
      { ruleId: result.insertId, threshold, actionType }
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Alert rule created successfully',
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to create alert rule');
  }
});

/**
 * PUT /api/alerts/:id
 * Update an alert rule
 */
router.put('/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const { name, thresholdScore, actionType, actionConfig, isActive } = req.body;

    const existing = await db.select().from(alertRules)
      .where(and(eq(alertRules.id, ruleId), eq(alertRules.storeId, req.storeId)));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (thresholdScore !== undefined) updates.thresholdScore = requireThreshold(thresholdScore).toFixed(2);
    if (actionType !== undefined) updates.actionType = requireEnum(actionType, ACTION_TYPES, 'actionType');
    if (actionConfig !== undefined) updates.actionConfig = actionConfig;
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(alertRules).set(updates).where(eq(alertRules.id, ruleId));

    await logActivity(existing[0].storeId, null, 'rule_updated',
      `Alert rule "${existing[0].name}" updated`,
      { ruleId, updates: Object.keys(updates) }
    );

    res.json({ message: 'Alert rule updated successfully' });
  } catch (error) {
    respondWithError(res, error, 'Failed to update alert rule');
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert rule
 */
router.delete('/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const rule = await db.select().from(alertRules)
      .where(and(eq(alertRules.id, ruleId), eq(alertRules.storeId, req.storeId)));

    if (rule.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    await logActivity(rule[0].storeId, null, 'rule_deleted',
      `Alert rule "${rule[0].name}" deleted`,
      { ruleId }
    );

    await db.delete(alertRules).where(eq(alertRules.id, ruleId));
    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    respondWithError(res, error, 'Failed to delete alert rule');
  }
});

export default router;
