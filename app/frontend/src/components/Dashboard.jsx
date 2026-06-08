import React, { useState, useEffect } from 'react';
import { formatActivityText, formatStatusLabel } from '../utils/activity';

const API_BASE = '/api';
const STORE_ID = 1; // Demo store

// Mock data for demo when API is not available
const MOCK_DASHBOARD = {
  metrics: {
    totalProducts: 9,
    totalBatches: 17,
    avgFreshness: '51.1',
    wasteRate: '2.7',
    atRiskCount: 5,
    expiredCount: 2,
    totalQuantity: 850,
    totalSold: 369,
    wastedQuantity: 23,
  },
  distribution: { active: 8, warning: 2, critical: 3, expired: 2, sold_out: 2 },
  atRiskBatches: [
    { id: 1, lotNumber: 'VL-2026-031', freshnessScore: '41.20', status: 'warning', expiresAt: '2026-09-01', productTitle: 'Ali Shan High Mountain' },
    { id: 2, lotNumber: 'VL-2026-028', freshnessScore: '12.30', status: 'critical', expiresAt: '2026-06-20', productTitle: 'Golden Yunnan Tips' },
    { id: 3, lotNumber: 'VL-2026-025', freshnessScore: '21.90', status: 'critical', expiresAt: '2026-07-30', productTitle: 'Uji Sencha Reserve' },
  ],
  recentActivity: [
    { id: 1, action: 'alert_triggered', description: 'Alert "Low Freshness" triggered for batch VL-2026-028 (score: 12.3 < threshold: 15)', createdAt: '2026-06-05T08:00:00Z' },
    { id: 2, action: 'score_updated', description: 'Batch VL-2026-031: active → warning (score: 22.5)', createdAt: '2026-06-05T06:00:00Z' },
    { id: 3, action: 'batch_created', description: 'New batch VL-2026-045 created (qty: 55, freshness: 96.8%)', createdAt: '2026-05-28T12:00:00Z' },
    { id: 4, action: 'discount_applied', description: 'Auto-discount of 20% applied to batch VL-2026-019', createdAt: '2026-06-04T08:00:00Z' },
    { id: 5, action: 'rule_created', description: 'Alert rule "Critical Stock" created (threshold: 10%, action: email)', createdAt: '2026-06-03T10:00:00Z' },
  ],
  recalculation: { updated: 3, alertsTriggered: 1 },
};

function getScoreColor(score) {
  const s = parseFloat(score);
  if (s >= 60) return '#27ae60';
  if (s >= 30) return '#f39c12';
  if (s > 0) return '#e74c3c';
  return '#95a5a6';
}

function getActionIcon(action) {
  const map = {
    batch_created: { icon: '📦', cls: 'create' },
    batch_updated: { icon: '✏️', cls: 'update' },
    score_updated: { icon: '📊', cls: 'update' },
    alert_triggered: { icon: '🔔', cls: 'alert' },
    discount_applied: { icon: '💰', cls: 'create' },
    batch_expired: { icon: '⚠️', cls: 'expire' },
    batch_sold_out: { icon: '✅', cls: 'create' },
    rule_created: { icon: '⚙️', cls: 'update' },
    rule_updated: { icon: '⚙️', cls: 'update' },
    rule_deleted: { icon: '🗑️', cls: 'expire' },
  };
  return map[action] || { icon: '📋', cls: 'update' };
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch(`${API_BASE}/dashboard?storeId=${STORE_ID}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(MOCK_DASHBOARD);
      }
    } catch {
      setData(MOCK_DASHBOARD);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--ft-text-muted)' }}>
        Loading dashboard...
      </div>
    );
  }

  if (!data) return null;

  const { metrics, distribution, atRiskBatches, recentActivity } = data;
  const totalDist = distribution.active + distribution.warning + distribution.critical + distribution.expired;
  const visibleAtRiskBatches = (atRiskBatches || []).slice(0, 5);
  const visibleRecentActivity = (recentActivity || []).slice(0, 5);

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1>Inventory Overview</h1>
        <p>A quick view of what is ready to sell, what needs attention, and what changed recently.</p>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__label">Inventory Batches</div>
          <div className="metric-card__value">{metrics.totalBatches}</div>
          <div className="metric-card__sub">Across {metrics.totalProducts} products</div>
        </div>
        <div className="metric-card metric-card--success">
          <div className="metric-card__label">Average Shelf Life</div>
          <div className="metric-card__value">{metrics.avgFreshness}%</div>
          <div className="metric-card__sub">Remaining across tracked batches</div>
        </div>
        <div className="metric-card metric-card--warning">
          <div className="metric-card__label">Needs Attention</div>
          <div className="metric-card__value">{metrics.atRiskCount}</div>
          <div className="metric-card__sub">Batches to review soon</div>
        </div>
        <div className="metric-card metric-card--danger">
          <div className="metric-card__label">Expired Waste</div>
          <div className="metric-card__value">{metrics.wasteRate}%</div>
          <div className="metric-card__sub">{metrics.wastedQuantity} units past expiry</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-main-stack">
          {/* Freshness Distribution */}
          <div className="panel dashboard-health-panel">
            <div className="panel__header">
              <span className="panel__title">Inventory Health</span>
              <button className="btn btn--secondary btn--sm" onClick={fetchDashboard}>
                Refresh
              </button>
            </div>
            <div className="panel__body">
              {totalDist > 0 && (
                <div className="freshness-bar">
                  <div className="freshness-bar__segment freshness-bar__segment--active" style={{ width: `${(distribution.active / totalDist) * 100}%` }} />
                  <div className="freshness-bar__segment freshness-bar__segment--warning" style={{ width: `${(distribution.warning / totalDist) * 100}%` }} />
                  <div className="freshness-bar__segment freshness-bar__segment--critical" style={{ width: `${(distribution.critical / totalDist) * 100}%` }} />
                  <div className="freshness-bar__segment freshness-bar__segment--expired" style={{ width: `${(distribution.expired / totalDist) * 100}%` }} />
                </div>
              )}
              <div className="freshness-legend">
                <div className="freshness-legend__item">
                  <div className="freshness-legend__dot" style={{ background: '#27ae60' }} />
                  Ready to sell ({distribution.active})
                </div>
                <div className="freshness-legend__item">
                  <div className="freshness-legend__dot" style={{ background: '#f39c12' }} />
                  Check soon ({distribution.warning})
                </div>
                <div className="freshness-legend__item">
                  <div className="freshness-legend__dot" style={{ background: '#e74c3c' }} />
                  Action needed ({distribution.critical})
                </div>
                <div className="freshness-legend__item">
                  <div className="freshness-legend__dot" style={{ background: '#95a5a6' }} />
                  Past expiry ({distribution.expired})
                </div>
              </div>
            </div>
          </div>

          {/* At-Risk Batches */}
          <div className="panel dashboard-review-panel">
            <div className="panel__header">
              <span className="panel__title">Batches to Review</span>
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {visibleAtRiskBatches.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Product</th>
                      <th>Shelf life left</th>
                      <th>Next step</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAtRiskBatches.map(batch => {
                      const score = parseFloat(batch.freshnessScore);
                      return (
                        <tr key={batch.id}>
                          <td><strong>{batch.lotNumber}</strong></td>
                          <td>{batch.productTitle}</td>
                          <td>
                            <div className="freshness-score">
                              <div className="freshness-score__bar">
                                <div className="freshness-score__fill" style={{ width: `${score}%`, background: getScoreColor(score) }} />
                              </div>
                              <span style={{ color: getScoreColor(score), fontSize: 12 }}>{score.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-badge--${batch.status}`}>
                              {formatStatusLabel(batch.status)}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>
                            {new Date(batch.expiresAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon">✅</div>
                  <div className="empty-state__title">Everything looks healthy</div>
                  <div className="empty-state__text">No batches need attention right now.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column — Activity Feed */}
        <div className="dashboard-activity-stack">
          <div className="panel dashboard-activity-panel">
            <div className="panel__header">
              <span className="panel__title">Recent Updates</span>
            </div>
            <div className="panel__body" style={{ padding: '12px 20px' }}>
              {visibleRecentActivity.length > 0 ? (
                visibleRecentActivity.map(entry => {
                  const { icon, cls } = getActionIcon(entry.action);
                  return (
                    <div className="log-entry" key={entry.id}>
                      <div className={`log-entry__icon log-entry__icon--${cls}`}>
                        {icon}
                      </div>
                      <div className="log-entry__content">
                        <div className="log-entry__text">{formatActivityText(entry)}</div>
                        <div className="log-entry__time">{timeAgo(entry.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon">📋</div>
                  <div className="empty-state__text">No updates yet</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
