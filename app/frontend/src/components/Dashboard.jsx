import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { CheckCircleIcon, ClipboardIcon } from './Icons';
import { formatActivityText, formatStatusLabel } from '../utils/activity';
import { getScoreColor, timeAgo } from '../utils/format';
import { getActivityMeta } from '../utils/activityMeta';
import { api } from '../api';
import { useToast } from './Toast';

const EMPTY_DASHBOARD = {
  metrics: {
    totalProducts: 0,
    totalBatches: 0,
    avgFreshness: '0',
    wasteRate: '0',
    atRiskCount: 0,
    expiredCount: 0,
    totalQuantity: 0,
    totalSold: 0,
    wastedQuantity: 0,
  },
  distribution: { active: 0, warning: 0, critical: 0, expired: 0, sold_out: 0 },
  atRiskBatches: [],
  recentActivity: [],
  recalculation: { updated: 0, alertsTriggered: 0 },
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const notify = useToast();

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      setData(await api.getDashboard());
    } catch (err) {
      setData(EMPTY_DASHBOARD);
      notify(`Could not load dashboard: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        Loading dashboard…
      </div>
    );
  }

  if (!data) return null;

  const { metrics, distribution, atRiskBatches, recentActivity } = data;
  const totalDist = distribution.active + distribution.warning + distribution.critical
    + distribution.expired + (distribution.sold_out || 0);
  const visibleAtRiskBatches = (atRiskBatches || []).slice(0, 5);
  const visibleRecentActivity = (recentActivity || []).slice(0, 5);

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__row">
          <h1>Inventory Overview</h1>
        </div>
        <div className="page-header__row">
          <p>A quick view of what is ready to sell, what needs attention, and what changed recently.</p>
        </div>
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
              <button className="btn btn--secondary btn--sm" onClick={fetchDashboard} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="panel__body" style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
              {totalDist > 0 ? (
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                      data={[
                        { name: 'Ready', value: distribution.active, color: '#27ae60' },
                        { name: 'Warning', value: distribution.warning, color: '#f39c12' },
                        { name: 'Critical', value: distribution.critical, color: '#e74c3c' },
                        { name: 'Expired', value: distribution.expired, color: '#95a5a6' },
                        { name: 'Sold out', value: distribution.sold_out || 0, color: '#3498db' },
                      ]}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      barCategoryGap="15%"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#888' }}
                        dy={8}
                        interval={0}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#888' }}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip
                        formatter={(value, name) => [`${value} batches`, '']}
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--ft-border)', boxShadow: 'var(--ft-shadow)', padding: '8px 12px' }}
                        itemStyle={{ color: 'var(--ft-text)', fontWeight: 600 }}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {[
                          { name: 'Ready', value: distribution.active, color: '#27ae60' },
                          { name: 'Warning', value: distribution.warning, color: '#f39c12' },
                          { name: 'Critical', value: distribution.critical, color: '#e74c3c' },
                          { name: 'Expired', value: distribution.expired, color: '#95a5a6' },
                          { name: 'Sold out', value: distribution.sold_out || 0, color: '#3498db' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state__icon"><CheckCircleIcon size={32} /></div>
                  <div className="empty-state__title">No data yet</div>
                  <div className="empty-state__text">Add batches to see your inventory health.</div>
                </div>
              )}
            </div>
          </div>

          {/* At-Risk Batches */}
          <div className="panel dashboard-review-panel">
            <div className="panel__header">
              <span className="panel__title">Batches to Review</span>
              {visibleAtRiskBatches.length === 0 && metrics.atRiskCount === 0 && (
                <span style={{ fontSize: 11, color: 'var(--ft-success)', fontWeight: 500 }}>All healthy ✓</span>
              )}
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {visibleAtRiskBatches.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Product</th>
                      <th>Shelf life left</th>
                      <th>Status</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAtRiskBatches.map(batch => {
                      const score = parseFloat(batch.freshnessScore);
                      return (
                        <tr key={batch.id}>
                          <td data-label="Batch"><strong>{batch.lotNumber}</strong></td>
                          <td data-label="Product">{batch.productTitle}</td>
                          <td data-label="Shelf life left">
                            <div className="freshness-score">
                              <div className="freshness-score__bar">
                                <div className="freshness-score__fill" style={{ width: `${score}%`, background: getScoreColor(score) }} />
                              </div>
                              <span style={{ color: getScoreColor(score), fontSize: 12 }}>{score.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td data-label="Status">
                            <span className={`status-badge status-badge--${batch.status}`}>
                              {formatStatusLabel(batch.status)}
                            </span>
                          </td>
                          <td data-label="Expires" style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>
                            {new Date(batch.expiresAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ padding: '32px 20px' }}>
                  <div className="empty-state__icon" style={{ color: 'var(--ft-success)' }}><CheckCircleIcon size={32} /></div>
                  <div className="empty-state__title">Everything looks healthy</div>
                  <div className="empty-state__text">
                    No batches need attention right now.<br/>
                    <span style={{ fontSize: 11, color: 'var(--ft-text-muted)' }}>
                      Batches with less than 60% shelf life remaining will appear here.
                    </span>
                  </div>
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
            <div className="panel__body" style={{ padding: '16px 20px' }}>
              {visibleRecentActivity.length > 0 ? (
                visibleRecentActivity.map(entry => {
                  const { icon, cls } = getActivityMeta(entry);
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
                  <div className="empty-state__icon"><ClipboardIcon size={32} /></div>
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
