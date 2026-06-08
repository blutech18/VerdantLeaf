/**
 * FreshTrack — Alert Rules Routes
 * CRUD for configurable freshness alert rules
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { alertRules } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { logActivity } from '../services/freshness.js';

const router = Router();

/**
 * GET /api/alerts?storeId=1
 * List all alert rules for a store
 */
router.get('/', async (req, res) => {
  try {
    const storeId = parseInt(req.query.storeId || '1', 10);

    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.storeId, storeId))
      .orderBy(desc(alertRules.thresholdScore));

    res.json(rules);
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

/**
 * POST /api/alerts
 * Create a new alert rule
 */
router.post('/', async (req, res) => {
  try {
    const { storeId, name, thresholdScore, actionType, actionConfig } = req.body;

    if (!storeId || !name || thresholdScore === undefined || !actionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [result] = await db.insert(alertRules).values({
      storeId,
      name,
      thresholdScore: parseFloat(thresholdScore).toFixed(2),
      actionType,
      actionConfig: actionConfig ? JSON.stringify(actionConfig) : null,
      isActive: true,
    });

    await logActivity(storeId, null, 'rule_created',
      `Alert rule "${name}" created (threshold: ${thresholdScore}%, action: ${actionType})`,
      { ruleId: result.insertId, threshold: thresholdScore, actionType }
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Alert rule created successfully',
    });
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
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

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (thresholdScore !== undefined) updates.thresholdScore = parseFloat(thresholdScore).toFixed(2);
    if (actionType !== undefined) updates.actionType = actionType;
    if (actionConfig !== undefined) updates.actionConfig = JSON.stringify(actionConfig);
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(alertRules).set(updates).where(eq(alertRules.id, ruleId));

    // Get rule for logging
    const rule = await db.select().from(alertRules).where(eq(alertRules.id, ruleId));
    if (rule.length > 0) {
      await logActivity(rule[0].storeId, null, 'rule_updated',
        `Alert rule "${rule[0].name}" updated`,
        { ruleId, updates: Object.keys(updates) }
      );
    }

    res.json({ message: 'Alert rule updated successfully' });
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Delete an alert rule
 */
router.delete('/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const rule = await db.select().from(alertRules).where(eq(alertRules.id, ruleId));

    if (rule.length > 0) {
      await logActivity(rule[0].storeId, null, 'rule_deleted',
        `Alert rule "${rule[0].name}" deleted`,
        { ruleId }
      );
    }

    await db.delete(alertRules).where(eq(alertRules.id, ruleId));
    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

export default router;
