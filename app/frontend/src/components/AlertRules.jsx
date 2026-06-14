import React, { useState, useEffect } from 'react';
import { DollarIcon, MailIcon, LinkIcon, LightbulbIcon, BellIcon } from './Icons';
import { api, getStoreId } from '../api';
import { useToast } from './Toast';
// Note: BellIcon kept for empty state

const ACTION_LABELS = {
  discount: { label: 'Auto-Discount', icon: <DollarIcon size={20} />, color: '#27ae60' },
  email: { label: 'Email Alert', icon: <MailIcon size={20} />, color: '#3498db' },
  webhook: { label: 'Webhook', icon: <LinkIcon size={20} />, color: '#9b59b6' },
};

// Recommended default rules for freshness monitoring
const DEFAULT_RULES = [
  {
    name: 'Low Freshness Warning',
    thresholdScore: 30,
    actionType: 'email',
    actionConfig: { email_to: '' },
    description: 'Get notified when batches drop below 30% shelf life',
  },
  {
    name: 'Critical Stock Alert',
    thresholdScore: 15,
    actionType: 'discount',
    actionConfig: { discount_percent: 15 },
    description: 'Auto-apply 15% discount when shelf life is under 15%',
  },
  {
    name: 'Near Expiry Emergency',
    thresholdScore: 5,
    actionType: 'discount',
    actionConfig: { discount_percent: 30 },
    description: 'Apply 30% discount to nearly expired batches',
  },
];

async function createDefaultRules(notify, onComplete) {
  try {
    for (const rule of DEFAULT_RULES) {
      await api.createAlert({
        name: rule.name,
        thresholdScore: rule.thresholdScore,
        actionType: rule.actionType,
        actionConfig: rule.actionConfig,
      });
    }
    notify('Created 3 recommended alert rules!', 'success');
    onComplete();
  } catch (err) {
    notify(`Could not create default rules: ${err.message}`, 'error');
  }
}

function parseActionConfig(actionConfig) {
  if (!actionConfig) return {};
  return typeof actionConfig === 'string' ? JSON.parse(actionConfig) : actionConfig;
}

export default function AlertRules() {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const notify = useToast();

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      setRules(await api.getAlerts());
    } catch (err) {
      setRules([]);
      notify(`Could not load alert rules: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(rule) {
    // Optimistic update, reverted if the request fails.
    const next = !rule.isActive;
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: next } : r));
    try {
      await api.updateAlert(rule.id, { isActive: next });
    } catch (err) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: rule.isActive } : r));
      notify(`Could not update rule: ${err.message}`, 'error');
    }
  }

  async function deleteRule(rule) {
    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) return;
    try {
      await api.deleteAlert(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      notify(`Rule "${rule.name}" deleted.`, 'success');
    } catch (err) {
      notify(`Could not delete rule: ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header__row">
          <h1>Alert Rules</h1>
        </div>
        <div className="page-header__row">
          <p>Set reminders, discounts, and notifications as batches get close to expiry.</p>
          <button className="btn btn--primary" onClick={() => { setEditRule(null); setShowForm(true); }}>
            + New Rule
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ color: 'var(--ft-primary)' }}><LightbulbIcon size={28} /></div>
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
      {loading ? (
        <div className="panel">
          <div className="loading-state">
            <div className="spinner" />
            Loading alert rules…
          </div>
        </div>
      ) : rules.length > 0 ? (
        <div className="panel">
          <div className="panel__body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Trigger Condition</th>
                  <th>Automation Action</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...rules]
                  .sort((a, b) => parseFloat(b.thresholdScore) - parseFloat(a.thresholdScore))
                  .map(rule => {
                    const action = ACTION_LABELS[rule.actionType] || ACTION_LABELS.email;
                    const config = parseActionConfig(rule.actionConfig);

                    return (
                      <tr key={rule.id} style={{ opacity: rule.isActive ? 1 : 0.6 }}>
                        <td data-label="Rule Name">
                          <strong>{rule.name}</strong>
                        </td>
                        <td data-label="Trigger Condition">
                          <div>
                            Under <strong style={{ color: 'var(--ft-danger)' }}>{parseFloat(rule.thresholdScore).toFixed(0)}%</strong>
                          </div>
                        </td>
                        <td data-label="Automation Action">
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textAlign: 'left', color: action.color, fontWeight: 500, background: `${action.color}15`, padding: '6px 10px', borderRadius: 6, fontSize: 12, maxWidth: '100%' }}>
                            <span style={{ display: 'flex', flexShrink: 0 }}>
                              {action.icon}
                            </span>
                            <span style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                              {rule.actionType === 'discount' && config.discount_percent
                                ? `Apply ${config.discount_percent}% discount`
                                : rule.actionType === 'email' && config.email_to
                                ? <><span className="hide-on-mobile">Email </span>{config.email_to}</>
                                : rule.actionType === 'webhook'
                                ? 'Fire webhook'
                                : action.label}
                            </span>
                          </div>
                        </td>
                        <td data-label="Status">
                          <span className={`status-badge ${rule.isActive ? 'status-badge--active' : 'status-badge--expired'}`}>
                            {rule.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
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
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-state__icon"><BellIcon size={32} /></div>
            <div className="empty-state__title">No alert rules yet</div>
            <div className="empty-state__text">Create your first rule to automate freshness monitoring.</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn--primary" onClick={() => setShowForm(true)}>+ New Rule</button>
              <button className="btn btn--secondary" onClick={() => createDefaultRules(notify, fetchRules)}>
                Create Recommended Rules
              </button>
            </div>
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
  const notify = useToast();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const config = parseActionConfig(rule?.actionConfig);

  const [form, setForm] = useState({
    storeId: getStoreId(),
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
    setError('');
    setSaving(true);

    const actionConfig = {};
    if (form.actionType === 'discount') actionConfig.discount_percent = parseInt(form.discountPercent, 10);
    if (form.actionType === 'email') actionConfig.email_to = form.emailTo;
    if (form.actionType === 'webhook') actionConfig.webhook_url = form.webhookUrl;

    const payload = {
      storeId: getStoreId(),
      name: form.name,
      thresholdScore: form.thresholdScore,
      actionType: form.actionType,
      actionConfig,
    };

    try {
      if (isEdit) {
        await api.updateAlert(rule.id, payload);
      } else {
        await api.createAlert(payload);
      }
      notify(`Rule "${form.name}" ${isEdit ? 'updated' : 'created'}.`, 'success');
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
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
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Alert Level (%) *</label>
                <input className="form-input" name="thresholdScore" type="number" min="1" max="99" value={form.thresholdScore} onChange={handleChange} required placeholder="e.g. 30" />
              </div>
              <div className="form-group">
                <label className="form-label">Action Type *</label>
                <select className="form-select" name="actionType" value={form.actionType} onChange={handleChange}>
                  <option value="email">Send Email Alert</option>
                  <option value="discount">Auto-Apply Discount</option>
                  <option value="webhook">Fire Webhook</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ft-text-muted)', marginTop: -8, marginBottom: 16 }}>
              The action runs when a batch has less shelf life left than the alert level.
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
            {error && <span className="form-error" style={{ marginRight: 'auto' }}>{error}</span>}
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
