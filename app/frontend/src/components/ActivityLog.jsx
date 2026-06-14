import React, { useState, useEffect } from 'react';
import { formatActivityText } from '../utils/activity';
import { formatDateTime } from '../utils/format';
import { getActivityMeta } from '../utils/activityMeta';
import { ClipboardIcon } from './Icons';
import { api } from '../api';
import { useToast } from './Toast';

const ITEMS_PER_PAGE = 10;

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const notify = useToast();

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, startDate, endDate, search, sortDir, currentPage]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const data = await api.getLogs({
        action: filter !== 'all' ? filter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
        sortDir,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      setLogs([]);
      setTotal(0);
      notify(`Could not load activity: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const actionFilters = [
    { value: 'all', label: 'All Activity' },
    { value: 'alert_triggered', label: 'Alerts' },
    { value: 'score_updated', label: 'Shelf Life Updates' },
    { value: 'batch_created', label: 'Batches Created' },
    { value: 'discount_applied', label: 'Discounts' },
    { value: 'batch_expired', label: 'Expired' },
  ];

  return (
    <div className="activity-log-page">
      <div className="page-header">
        <div className="page-header__row">
          <h1>Activity Log</h1>
        </div>
        <div className="page-header__row">
          <p>Full audit trail of all batch updates, alerts, and automated actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-controls">
        <div className="ft-control-group">
          <label>Search</label>
          <input 
            type="text" 
            className="ft-input" 
            placeholder="Search activity..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="ft-control-group">
          <label>Type</label>
          <select 
            className="ft-select" 
            value={filter} 
            onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
          >
            {actionFilters.map(f => (
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

      {/* Log Entries */}
      <div className="panel">
        <div className="panel__body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ft-text-muted)' }}>Loading...</div>
          ) : logs.length > 0 ? (
            <>
              <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Type</th>
                      <th style={{ textAlign: 'center' }}>Description</th>
                      <th style={{ textAlign: 'center' }}>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(entry => {
                      const action = getActivityMeta(entry);
                      return (
                        <tr key={entry.id}>
                          <td data-label="Type">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className={`log-entry__icon--${action.cls}`} style={{ minWidth: 28, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                                {action.icon}
                              </div>
                              <strong style={{ whiteSpace: 'nowrap' }}>{action.label}</strong>
                            </div>
                          </td>
                          <td data-label="Description" style={{ textAlign: 'center' }}>
                            <div>
                              {formatActivityText(entry)}
                            </div>
                          </td>
                          <td data-label="Date & Time" style={{ color: 'var(--ft-text-muted)', textAlign: 'center' }}>
                            <div>
                              {formatDateTime(entry.createdAt)}
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
                    Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, total)} of {total} entries
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn btn--secondary" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button 
                      className="btn btn--secondary" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon"><ClipboardIcon size={32} /></div>
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
