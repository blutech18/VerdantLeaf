import React, { useState, useEffect } from 'react';
import { formatStatusLabel } from '../utils/activity';
import { getScoreColor, categoryLabel, shopifyAdminProductUrl } from '../utils/format';
import { PackageIcon, TrashIcon, ExternalLinkIcon } from './Icons';
import { getEmbeddedContext } from '../shopifyAppBridge';
import { api } from '../api';
import { useToast } from './Toast';

const SHOP_DOMAIN = getEmbeddedContext().shop || 'verdantleafshop.myshopify.com';

export default function BatchManager() {
  const [batches, setBatches] = useState([]);
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const notify = useToast();

  useEffect(() => {
    syncCatalogAndRefresh({ quiet: true });
  }, []);

  async function syncCatalogAndRefresh({ quiet = false } = {}) {
    setSyncing(true);
    if (!quiet) setLoading(true);
    try {
      const summary = await api.syncProducts();
      setLastSynced(summary.syncedAt);
      if (!quiet) {
        notify(
          `Synced ${summary.total} products from Shopify (${summary.created} new, ${summary.updated} updated).`,
          'success'
        );
      }
    } catch (err) {
      if (!quiet) {
        notify(`Shopify sync failed: ${err.message}`, 'error');
      }
    } finally {
      setSyncing(false);
      await Promise.all([fetchProducts(), fetchBatches()]);
    }
  }

  async function fetchBatches() {
    setLoading(true);
    try {
      setBatches(await api.getBatches());
    } catch (err) {
      setBatches([]);
      notify(`Could not load batches: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      setProducts(await api.getProducts());
    } catch {
      setProducts([]);
    }
  }

  async function handleDelete(batch) {
    if (!window.confirm(`Delete batch ${batch.lotNumber}? This cannot be undone.`)) return;
    try {
      await api.deleteBatch(batch.id);
      notify(`Batch ${batch.lotNumber} deleted.`, 'success');
      fetchBatches();
    } catch (err) {
      notify(`Could not delete batch: ${err.message}`, 'error');
    }
  }

  const filtered = batches.filter(b => {
    // Status filter
    if (filter !== 'all' && b.status !== filter) return false;
    
    // Date range filter (each date works independently)
    const expDate = new Date(b.expiresAt);
    expDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (expDate < start) return false;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (expDate > end) return false;
    }

    // Search filter
    if (search) {
      const term = search.toLowerCase();
      if (!b.lotNumber?.toLowerCase().includes(term) && 
          !b.productTitle?.toLowerCase().includes(term) && 
          !b.supplier?.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const statusCounts = batches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBatches = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const statusFilters = [
    { value: 'all', label: `All (${batches.length})` },
    ...['active', 'warning', 'critical', 'expired', 'sold_out'].map(f => ({
      value: f,
      label: `${formatStatusLabel(f)} ${statusCounts[f] ? `(${statusCounts[f]})` : ''}`
    }))
  ];

  return (
    <div className="batch-manager-page">
      <div className="page-header">
        <div className="page-header__row">
          <h1>Batch Management</h1>
          {lastSynced && (
            <span className="page-header__sync-time">
              Last sync: {new Date(lastSynced).toLocaleString()}
            </span>
          )}
        </div>
        <div className="page-header__row">
          <p>
            Stock and products sync automatically from your Shopify catalog. Edit a row to set the real expiry date and lot details.
          </p>
          <button
            className="btn btn--secondary"
            onClick={() => syncCatalogAndRefresh()}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync from Shopify'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-controls">
        <div className="ft-control-group">
          <label>Search</label>
          <input 
            type="text" 
            className="ft-input" 
            placeholder="Search batches..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="ft-control-group">
          <label>Status</label>
          <select 
            className="ft-select" 
            value={filter} 
            onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
          >
            {statusFilters.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="ft-control-group">
          <label>Sort</label>
          <select 
            className="ft-select" 
            value={sortDir} 
            onChange={(e) => { setSortDir(e.target.value); setCurrentPage(1); }}
          >
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
        </div>
        <div className="ft-control-group">
          <label>From</label>
          <input 
            type="date" 
            className="ft-date-input" 
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="ft-control-group">
          <label>To</label>
          <input 
            type="date" 
            className="ft-date-input" 
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="panel">
        <div className="panel__body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              Loading batches…
            </div>
          ) : filtered.length > 0 ? (
            <>
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
                  {paginatedBatches.map(batch => {
                    const score = parseFloat(batch.freshnessScore);
                    const remaining = batch.quantity - batch.quantitySold;
                    const shopifyUrl = shopifyAdminProductUrl(batch.shopifyProductId, SHOP_DOMAIN);
                    return (
                      <tr key={batch.id}>
                        <td data-label="Lot Number"><strong>{batch.lotNumber}</strong></td>
                        <td data-label="Product">
                          {shopifyUrl ? (
                            <a
                              className="product-trace-link"
                              href={shopifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View ${batch.productTitle} in Shopify admin`}
                            >
                              {batch.productTitle}
                              <ExternalLinkIcon size={12} />
                            </a>
                          ) : (
                            batch.productTitle
                          )}
                        </td>
                        <td data-label="Category" style={{ fontSize: 12 }}>{categoryLabel(batch.productCategory)}</td>
                        <td data-label="Shelf life left">
                          <div className="freshness-score">
                            <div className="freshness-score__bar">
                              <div className="freshness-score__fill" style={{ width: `${Math.max(0, score)}%`, background: getScoreColor(score) }} />
                            </div>
                            <span style={{ color: getScoreColor(score), fontSize: 12 }}>{score.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td data-label="Next step">
                          <span className={`status-badge status-badge--${batch.status}`}>
                            {formatStatusLabel(batch.status)}
                          </span>
                        </td>
                        <td data-label="Stock" style={{ fontSize: 13 }}>
                          {remaining}
                        </td>
                        <td data-label="Expires" style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>
                          {new Date(batch.expiresAt).toLocaleDateString()}
                        </td>
                        <td data-label="Supplier" style={{ fontSize: 12, color: 'var(--ft-text-muted)' }}>{batch.supplier || '—'}</td>
                        <td data-label="Actions">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className="btn btn--secondary btn--sm"
                              onClick={() => { setEditBatch(batch); setShowForm(true); }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              aria-label={`Delete batch ${batch.lotNumber}`}
                              onClick={() => handleDelete(batch)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ft-border)', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontSize: 13, color: 'var(--ft-text-muted)' }}>
                    Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn btn--secondary" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Previous
                    </button>
                    <button 
                      className="btn btn--secondary" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><PackageIcon size={32} /></div>
              <div className="empty-state__title">No batches yet</div>
              <div className="empty-state__text">
                {filter !== 'all' ? 'No batches match this view. Try a different filter.' : 'Click "Sync from Shopify" to mirror your catalog and start tracking shelf life.'}
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
  const notify = useToast();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
    setError('');
    setSaving(true);
    const payload = {
      ...form,
      productId: parseInt(form.productId, 10),
      quantity: parseInt(form.quantity, 10),
      quantitySold: parseInt(form.quantitySold || 0, 10),
    };
    try {
      if (isEdit) {
        await api.updateBatch(batch.id, payload);
      } else {
        await api.createBatch(payload);
      }
      notify(`Batch ${form.lotNumber} ${isEdit ? 'updated' : 'created'}.`, 'success');
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
          <h3 className="modal__title">{isEdit ? 'Edit Batch' : 'New Batch'}</h3>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Product</label>
              <input
                className="form-input"
                value={`${batch?.productTitle || ''}${batch?.productCategory ? ` (${categoryLabel(batch.productCategory)})` : ''}`}
                disabled
                readOnly
              />
              <span style={{ fontSize: 11, color: 'var(--ft-text-muted)' }}>
                Synced from Shopify — manage the product in your Shopify admin.
              </span>
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
            {error && <span className="form-error" style={{ marginRight: 'auto' }}>{error}</span>}
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Batch' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
