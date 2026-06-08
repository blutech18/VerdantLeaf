import React, { useState, useEffect } from 'react';
import { formatStatusLabel } from '../utils/activity';

const API_BASE = '/api';
const STORE_ID = 1;

const MOCK_BATCHES = [
  { id: 1, productId: 1, lotNumber: 'VL-2026-042', quantity: 100, quantitySold: 12, manufacturedAt: '2026-05-20', expiresAt: '2026-11-20', freshnessScore: 92.5, status: 'active', supplier: 'Uji Tea Farm Co.', productTitle: 'Uji Sencha Reserve', productCategory: 'green_tea' },
  { id: 2, productId: 2, lotNumber: 'VL-2026-039', quantity: 75, quantitySold: 45, manufacturedAt: '2026-04-15', expiresAt: '2026-10-15', freshnessScore: 72.3, status: 'active', supplier: 'Yunnan Harvest Ltd.', productTitle: 'Golden Yunnan Tips', productCategory: 'black_tea' },
  { id: 3, productId: 3, lotNumber: 'VL-2026-031', quantity: 50, quantitySold: 30, manufacturedAt: '2026-02-01', expiresAt: '2026-09-01', freshnessScore: 41.2, status: 'warning', supplier: 'Ali Shan Collective', productTitle: 'Ali Shan High Mountain', productCategory: 'oolong' },
  { id: 4, productId: 2, lotNumber: 'VL-2026-028', quantity: 60, quantitySold: 48, manufacturedAt: '2026-01-10', expiresAt: '2026-06-20', freshnessScore: 12.3, status: 'critical', supplier: 'Yunnan Harvest Ltd.', productTitle: 'Golden Yunnan Tips', productCategory: 'black_tea' },
  { id: 5, productId: 9, lotNumber: 'VL-2026-045', quantity: 55, quantitySold: 6, manufacturedAt: '2026-05-28', expiresAt: '2027-01-28', freshnessScore: 91.4, status: 'active', supplier: 'Darjeeling Estate', productTitle: 'Darjeeling First Flush', productCategory: 'black_tea' },
  { id: 6, productId: 9, lotNumber: 'VL-2026-015', quantity: 30, quantitySold: 18, manufacturedAt: '2025-10-15', expiresAt: '2026-04-15', freshnessScore: 0, status: 'expired', supplier: 'Darjeeling Estate', productTitle: 'Darjeeling First Flush', productCategory: 'black_tea' },
];

const MOCK_PRODUCTS = [
  { id: 1, title: 'Uji Sencha Reserve', category: 'green_tea' },
  { id: 2, title: 'Golden Yunnan Tips', category: 'black_tea' },
  { id: 3, title: 'Ali Shan High Mountain', category: 'oolong' },
  { id: 4, title: 'Silver Needle Bai Hao', category: 'white_tea' },
  { id: 5, title: 'Ancient Tree Pu-erh', category: 'puerh' },
  { id: 6, title: 'Chamomile Meadow Blend', category: 'herbal' },
  { id: 7, title: 'Ceremonial Grade Matcha', category: 'matcha' },
  { id: 8, title: 'Dragon Pearl Jasmine', category: 'green_tea' },
  { id: 9, title: 'Darjeeling First Flush', category: 'black_tea' },
];

const CATEGORIES = {
  green_tea: 'Green Tea', black_tea: 'Black Tea', oolong: 'Oolong',
  white_tea: 'White Tea', puerh: "Pu-erh", herbal: 'Herbal', matcha: 'Matcha', other: 'Other'
};

function getScoreColor(score) {
  if (score >= 60) return '#27ae60';
  if (score >= 30) return '#f39c12';
  if (score > 0) return '#e74c3c';
  return '#95a5a6';
}

export default function BatchManager() {
  const [batches, setBatches] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      const res = await fetch(`${API_BASE}/batches?storeId=${STORE_ID}`);
      if (res.ok) {
        setBatches(await res.json());
      } else {
        setBatches(MOCK_BATCHES);
      }
    } catch {
      setBatches(MOCK_BATCHES);
    }
    setLoading(false);
  }

  async function fetchProducts() {
    try {
      const res = await fetch(`${API_BASE}/products?storeId=${STORE_ID}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.length ? data : MOCK_PRODUCTS);
      } else {
        setProducts(MOCK_PRODUCTS);
      }
    } catch {
      setProducts(MOCK_PRODUCTS);
    }
  }

  const filtered = filter === 'all'
    ? batches
    : batches.filter(b => b.status === filter);

  const statusCounts = batches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h1>Batch Management</h1>
        <p>Track inventory lots, expiry dates, and how much sellable life remains.</p>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => { setEditBatch(null); setShowForm(true); }}>
            + New Batch
          </button>
          <button className="btn btn--secondary" onClick={fetchBatches}>Update Shelf Life</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {['all', 'active', 'warning', 'critical', 'expired', 'sold_out'].map(f => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : formatStatusLabel(f)}
            {f !== 'all' && statusCounts[f] ? ` (${statusCounts[f]})` : f === 'all' ? ` (${batches.length})` : ''}
          </button>
        ))}
      </div>

      {/* Batches Table */}
      <div className="panel">
        <div className="panel__body" style={{ padding: 0 }}>
          {filtered.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot Number</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Shelf life left</th>
                  <th>Next step</th>
                  <th>Stock</th>
                  <th>Expires</th>
                  <th>Supplier</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(batch => {
                  const score = parseFloat(batch.freshnessScore);
                  const remaining = batch.quantity - batch.quantitySold;
                  return (
                    <tr key={batch.id}>
                      <td><strong>{batch.lotNumber}</strong></td>
                      <td>{batch.productTitle}</td>
                      <td style={{ fontSize: 12 }}>{CATEGORIES[batch.productCategory] || batch.productCategory}</td>
                      <td>
                        <div className="freshness-score">
                          <div className="freshness-score__bar">
                            <div className="freshness-score__fill" style={{ width: `${Math.max(0, score)}%`, background: getScoreColor(score) }} />
                          </div>
                          <span style={{ color: getScoreColor(score), fontSize: 12 }}>{score.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${batch.status}`}>
                          {formatStatusLabel(batch.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {batch.quantitySold}/{batch.quantity}
                        <div style={{ color: 'var(--ft-text-muted)', fontSize: 11 }}>{remaining} left</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>
                        {new Date(batch.expiresAt).toLocaleDateString()}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>{batch.supplier || '—'}</td>
                      <td>
                        <button
                          className="btn btn--secondary btn--sm"
                          onClick={() => { setEditBatch(batch); setShowForm(true); }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">📦</div>
              <div className="empty-state__title">No batches found</div>
              <div className="empty-state__text">
                {filter !== 'all' ? 'No batches match this view. Try a different filter.' : 'Create your first batch to start tracking shelf life.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch Form Modal */}
      {showForm && (
        <BatchFormModal
          batch={editBatch}
          products={products}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); fetchBatches(); }}
        />
      )}
    </div>
  );
}

function BatchFormModal({ batch, products, onClose, onSave }) {
  const isEdit = !!batch;
  const [form, setForm] = useState({
    productId: batch?.productId || products[0]?.id || 1,
    lotNumber: batch?.lotNumber || '',
    quantity: batch?.quantity || '',
    quantitySold: batch?.quantitySold || 0,
    manufacturedAt: batch?.manufacturedAt ? batch.manufacturedAt.split('T')[0] : '',
    expiresAt: batch?.expiresAt ? batch.expiresAt.split('T')[0] : '',
    supplier: batch?.supplier || '',
    notes: batch?.notes || '',
  });

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = isEdit ? `${API_BASE}/batches/${batch.id}` : `${API_BASE}/batches`;
      const method = isEdit ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          productId: parseInt(form.productId, 10),
          quantity: parseInt(form.quantity, 10),
          quantitySold: parseInt(form.quantitySold || 0, 10),
        }),
      });
    } catch (err) {
      console.log('Demo mode: form submitted');
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">{isEdit ? 'Edit Batch' : 'New Batch'}</h3>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select className="form-select" name="productId" value={form.productId} onChange={handleChange} required>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.title} ({CATEGORIES[product.category] || product.category})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Lot Number *</label>
              <input className="form-input" name="lotNumber" value={form.lotNumber} onChange={handleChange} required placeholder="e.g. VL-2026-043" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input className="form-input" name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required />
              </div>
              {isEdit && (
                <div className="form-group">
                  <label className="form-label">Quantity Sold</label>
                  <input className="form-input" name="quantitySold" type="number" min="0" value={form.quantitySold} onChange={handleChange} />
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Manufactured Date *</label>
                <input className="form-input" name="manufacturedAt" type="date" value={form.manufacturedAt} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date *</label>
                <input className="form-input" name="expiresAt" type="date" value={form.expiresAt} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input className="form-input" name="supplier" value={form.supplier} onChange={handleChange} placeholder="e.g. Uji Tea Farm Co." />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Any additional notes about this batch..." />
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary">{isEdit ? 'Update Batch' : 'Create Batch'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
