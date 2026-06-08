import React, { useState, useEffect } from 'react';

const API_BASE = '/api';
const STORE_ID = 1;

const MOCK_RULES = [
  { id: 1, name: 'Low Freshness Warning', thresholdScore: '30.00', actionType: 'email', actionConfig: { email_to: 'alerts@verdantleaf.com' }, isActive: true, createdAt: '2026-05-01T10:00:00Z' },
  { id: 2, name: 'Critical Stock Alert', thresholdScore: '15.00', actionType: 'discount', actionConfig: { discount_percent: 15 }, isActive: true, createdAt: '2026-05-01T10:00:00Z' },
  { id: 3, name: 'Near Expiry Emergency', thresholdScore: '5.00', actionType: 'discount', actionConfig: { discount_percent: 30 }, isActive: true, createdAt: '2026-05-15T08:00:00Z' },
  { id: 4, name: 'Webhook Notification', thresholdScore: '20.00', actionType: 'webhook', actionConfig: { webhook_url: 'https://hooks.slack.com/...' }, isActive: false, createdAt: '2026-05-20T14:00:00Z' },
];

const ACTION_LABELS = {
  discount: { label: 'Auto-Discount', icon: '💰', color: '#27ae60' },
  email: { label: 'Email Alert', icon: '📧', color: '#3498db' },
  webhook: { label: 'Webhook', icon: '🔗', color: '#9b59b6' },
};

export default function AlertRules() {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    try {
      const res = await fetch(`${API_BASE}/alerts?storeId=${STORE_ID}`);
      if (res.ok) setRules(await res.json());
      else setRules(MOCK_RULES);
    } catch { setRules(MOCK_RULES); }
    setLoading(false);
  }

  async function toggleRule(rule) {
    try {
      await fetch(`${API_BASE}/alerts/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
    } catch {}
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
  }

  async function deleteRule(rule) {
    if (!confirm(`Delete alert rule "${rule.name}"?`)) return;
    try { await fetch(`${API_BASE}/alerts/${rule.id}`, { method: 'DELETE' }); } catch {}
    setRules(prev => prev.filter(r => r.id !== rule.id));
  }

  return (
    <div>
      <div className="page-header">
        <h1>Alert Rules</h1>
        <p>Set reminders, discounts, and notifications as batches get close to expiry.</p>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => { setEditRule(null); setShowForm(true); }}>
            + New Rule
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ fontSize: 28 }}>💡</div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>How Alert Rules Work</div>
            <div style={{ fontSize: 13, color: 'var(--ft-text-muted)' }}>
              When a batch has less shelf life left than your alert level, FreshTrack can automatically apply discounts,
              send email reminders, or trigger webhooks.
            </div>
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {rules
            .sort((a, b) => parseFloat(b.thresholdScore) - parseFloat(a.thresholdScore))
            .map(rule => {
              const action = ACTION_LABELS[rule.actionType] || ACTION_LABELS.email;
              const config = typeof rule.actionConfig === 'string' ? JSON.parse(rule.actionConfig) : (rule.actionConfig || {});

              return (
                <div className="panel" key={rule.id} style={{ opacity: rule.isActive ? 1 : 0.6 }}>
                  <div className="panel__body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                    {/* Action Icon */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${action.color}15`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0
                    }}>
                      {action.icon}
                    </div>

                    {/* Rule Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {rule.name}
                        {!rule.isActive && <span style={{ fontSize: 11, color: 'var(--ft-text-muted)', marginLeft: 8 }}>(disabled)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>
                        When shelf life is under <strong style={{ color: 'var(--ft-danger)' }}>{parseFloat(rule.thresholdScore).toFixed(0)}%</strong>
                        {' → '}
                        <span style={{ color: action.color, fontWeight: 500 }}>
                          {rule.actionType === 'discount' && config.discount_percent
                            ? `Apply ${config.discount_percent}% discount`
                            : rule.actionType === 'email' && config.email_to
                            ? `Email ${config.email_to}`
                            : rule.actionType === 'webhook'
                            ? 'Fire webhook'
                            : action.label}
                        </span>
                      </div>
                    </div>

                    {/* Threshold Badge */}
                    <div style={{
                      background: 'var(--ft-bg)', padding: '6px 14px', borderRadius: 8,
                      fontSize: 18, fontWeight: 700, color: 'var(--ft-danger)',
                    }}>
                      {parseFloat(rule.thresholdScore).toFixed(0)}%
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--secondary btn--sm" onClick={() => toggleRule(rule)}>
                        {rule.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn btn--secondary btn--sm" onClick={() => { setEditRule(rule); setShowForm(true); }}>
                        Edit
                      </button>
                      <button className="btn btn--danger btn--sm" onClick={() => deleteRule(rule)}>
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon">🔔</div>
            <div className="empty-state__title">No alert rules yet</div>
            <div className="empty-state__text">Create your first rule to automate freshness monitoring.</div>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ New Rule</button>
          </div>
        </div>
      )}

      {/* Rule Form Modal */}
      {showForm && (
        <RuleFormModal
          rule={editRule}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchRules(); }}
        />
      )}
    </div>
  );
}

function RuleFormModal({ rule, onClose, onSave }) {
  const isEdit = !!rule;
  const config = rule?.actionConfig
    ? (typeof rule.actionConfig === 'string' ? JSON.parse(rule.actionConfig) : rule.actionConfig)
    : {};

  const [form, setForm] = useState({
    storeId: STORE_ID,
    name: rule?.name || '',
    thresholdScore: rule?.thresholdScore ? parseFloat(rule.thresholdScore) : '',
    actionType: rule?.actionType || 'email',
    discountPercent: config.discount_percent || 15,
    emailTo: config.email_to || '',
    webhookUrl: config.webhook_url || '',
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const actionConfig = {};
    if (form.actionType === 'discount') actionConfig.discount_percent = parseInt(form.discountPercent);
    if (form.actionType === 'email') actionConfig.email_to = form.emailTo;
    if (form.actionType === 'webhook') actionConfig.webhook_url = form.webhookUrl;

    const payload = {
      storeId: STORE_ID,
      name: form.name,
      thresholdScore: form.thresholdScore,
      actionType: form.actionType,
      actionConfig,
    };

    try {
      const url = isEdit ? `${API_BASE}/alerts/${rule.id}` : `${API_BASE}/alerts`;
      await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">{isEdit ? 'Edit Alert Rule' : 'New Alert Rule'}</h3>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Rule Name *</label>
              <input className="form-input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Low Freshness Warning" />
            </div>
            <div className="form-group">
              <label className="form-label">Alert Level (%) *</label>
              <input className="form-input" name="thresholdScore" type="number" min="1" max="99" value={form.thresholdScore} onChange={handleChange} required placeholder="e.g. 30" />
              <div style={{ fontSize: 11, color: 'var(--ft-text-muted)', marginTop: 4 }}>
                The action runs when a batch has less shelf life left than this value.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Action Type *</label>
              <select className="form-select" name="actionType" value={form.actionType} onChange={handleChange}>
                <option value="email">📧 Send Email Alert</option>
                <option value="discount">💰 Auto-Apply Discount</option>
                <option value="webhook">🔗 Fire Webhook</option>
              </select>
            </div>

            {form.actionType === 'discount' && (
              <div className="form-group">
                <label className="form-label">Discount Percentage</label>
                <input className="form-input" name="discountPercent" type="number" min="1" max="90" value={form.discountPercent} onChange={handleChange} />
              </div>
            )}
            {form.actionType === 'email' && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" name="emailTo" type="email" value={form.emailTo} onChange={handleChange} placeholder="alerts@yourstore.com" />
              </div>
            )}
            {form.actionType === 'webhook' && (
              <div className="form-group">
                <label className="form-label">Webhook URL</label>
                <input className="form-input" name="webhookUrl" type="url" value={form.webhookUrl} onChange={handleChange} placeholder="https://hooks.slack.com/..." />
              </div>
            )}
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary">{isEdit ? 'Update Rule' : 'Create Rule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
