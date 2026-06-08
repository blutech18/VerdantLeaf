import React, { useState, useEffect } from 'react';
import { formatActivityText } from '../utils/activity';

const API_BASE = '/api';
const STORE_ID = 1;

const MOCK_LOGS = [
  { id: 1, action: 'alert_triggered', description: 'Alert "Low Freshness Warning" triggered for batch VL-2026-028 (score: 12.3 < threshold: 15)', createdAt: '2026-06-05T08:00:00Z', metadata: { ruleName: 'Low Freshness Warning', threshold: 15, score: 12.3 } },
  { id: 2, action: 'discount_applied', description: 'Auto-discount of 15% applied to batch VL-2026-028', createdAt: '2026-06-05T08:00:01Z', metadata: { discount_percent: 15 } },
  { id: 3, action: 'score_updated', description: 'Batch VL-2026-031: active → warning (score: 22.5)', createdAt: '2026-06-05T06:00:00Z', metadata: { oldStatus: 'active', newStatus: 'warning', newScore: 22.5 } },
  { id: 4, action: 'batch_created', description: 'New batch VL-2026-045 created (qty: 55, freshness: 96.8%)', createdAt: '2026-05-28T12:00:00Z', metadata: { lotNumber: 'VL-2026-045', quantity: 55 } },
  { id: 5, action: 'rule_created', description: 'Alert rule "Near Expiry Emergency" created (threshold: 5%, action: discount)', createdAt: '2026-06-03T10:00:00Z', metadata: {} },
  { id: 6, action: 'batch_updated', description: 'Batch VL-2026-039 updated', createdAt: '2026-06-03T09:30:00Z', metadata: { updates: ['quantitySold'] } },
  { id: 7, action: 'score_updated', description: 'Batch VL-2026-025: active → warning (score: 28.1)', createdAt: '2026-06-02T06:00:00Z', metadata: {} },
  { id: 8, action: 'batch_expired', description: 'Batch VL-2026-015: warning → expired (score: 0.0)', createdAt: '2026-06-01T00:00:00Z', metadata: {} },
  { id: 9, action: 'alert_triggered', description: 'Alert "Critical Stock Alert" triggered for batch VL-2026-015 (score: 0.0 < threshold: 15)', createdAt: '2026-06-01T00:00:01Z', metadata: {} },
  { id: 10, action: 'batch_sold_out', description: 'Batch VL-2026-019 is sold out', createdAt: '2026-05-30T16:00:00Z', metadata: {} },
  { id: 11, action: 'batch_created', description: 'New batch VL-2026-039 created (qty: 75, freshness: 95.2%)', createdAt: '2026-05-28T11:00:00Z', metadata: {} },
  { id: 12, action: 'rule_updated', description: 'Alert rule "Low Freshness Warning" updated', createdAt: '2026-05-25T14:00:00Z', metadata: {} },
];

const ACTION_CONFIG = {
  batch_created: { icon: '📦', cls: 'create', label: 'Batch Created' },
  batch_updated: { icon: '✏️', cls: 'update', label: 'Batch Updated' },
  score_updated: { icon: '📊', cls: 'update', label: 'Shelf Life Updated' },
  alert_triggered: { icon: '🔔', cls: 'alert', label: 'Alert Triggered' },
  discount_applied: { icon: '💰', cls: 'create', label: 'Discount Applied' },
  batch_expired: { icon: '⚠️', cls: 'expire', label: 'Batch Expired' },
  batch_sold_out: { icon: '✅', cls: 'create', label: 'Batch Sold Out' },
  rule_created: { icon: '⚙️', cls: 'update', label: 'Rule Created' },
  rule_updated: { icon: '⚙️', cls: 'update', label: 'Rule Updated' },
  rule_deleted: { icon: '🗑️', cls: 'expire', label: 'Rule Deleted' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchLogs(); }, [filter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const actionParam = filter !== 'all' ? `&action=${filter}` : '';
      const res = await fetch(`${API_BASE}/logs?storeId=${STORE_ID}&limit=50${actionParam}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || data);
        setTotal(data.total || data.length);
      } else {
        const filtered = filter === 'all' ? MOCK_LOGS : MOCK_LOGS.filter(l => l.action === filter);
        setLogs(filtered);
        setTotal(filtered.length);
      }
    } catch {
      const filtered = filter === 'all' ? MOCK_LOGS : MOCK_LOGS.filter(l => l.action === filter);
      setLogs(filtered);
      setTotal(filtered.length);
    }
    setLoading(false);
  }

  // Group logs by date
  const groupedLogs = logs.reduce((groups, log) => {
    const date = new Date(log.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
    return groups;
  }, {});

  const actionFilters = [
    { value: 'all', label: 'All Activity' },
    { value: 'alert_triggered', label: '🔔 Alerts' },
    { value: 'score_updated', label: '📊 Shelf Life Updates' },
    { value: 'batch_created', label: '📦 Batches Created' },
    { value: 'discount_applied', label: '💰 Discounts' },
    { value: 'batch_expired', label: '⚠️ Expired' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Activity Log</h1>
        <p>Full audit trail of all batch updates, alerts, and automated actions</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {actionFilters.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ft-text-muted)' }}>
          {total} entries
        </div>
      </div>

      {/* Log Entries */}
      <div className="panel">
        <div className="panel__body" style={{ padding: '8px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ft-text-muted)' }}>Loading...</div>
          ) : logs.length > 0 ? (
            Object.entries(groupedLogs).map(([date, entries]) => (
              <div key={date}>
                <div style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--ft-text-muted)',
                  padding: '16px 0 8px', borderBottom: '1px solid var(--ft-border)',
                }}>
                  {date}
                </div>
                {entries.map(entry => {
                  const action = ACTION_CONFIG[entry.action] || ACTION_CONFIG.batch_updated;
                  return (
                    <div className="log-entry" key={entry.id}>
                      <div className={`log-entry__icon log-entry__icon--${action.cls}`}>
                        {action.icon}
                      </div>
                      <div className="log-entry__content">
                        <div className="log-entry__text">
                          <span style={{ fontWeight: 500, color: 'var(--ft-green-dark)', marginRight: 6 }}>
                            {action.label}
                          </span>
                          {formatActivityText(entry)}
                        </div>
                        <div className="log-entry__time">
                          {formatDate(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">📋</div>
              <div className="empty-state__title">No activity found</div>
              <div className="empty-state__text">
                {filter !== 'all' ? 'No entries match this filter.' : 'Activity will appear here as you manage batches.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
