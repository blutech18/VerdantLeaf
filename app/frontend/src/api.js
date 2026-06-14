/**
 * FreshTrack — API client
 *
 * A single fetch wrapper that throws a readable Error on non-2xx responses so
 * components can surface failures (toasts) instead of failing silently.
 *
 * Store ID is resolved after OAuth install (see App.jsx install-status check).
 * Embedded apps map shop domain → store row; demo seed store id 1 is a fallback.
 */

export const API_BASE = '/api';

let storeId = 1;

// Optional async getter that returns a Shopify session token (JWT). Registered
// by App.jsx once App Bridge is ready so every request carries the token.
let sessionTokenGetter = null;

export function registerSessionTokenGetter(fn) {
  sessionTokenGetter = typeof fn === 'function' ? fn : null;
}

/** Called once install-status returns the OAuth-connected store. */
export function configureStore({ id } = {}) {
  if (id) storeId = id;
}

export function getStoreId() {
  return storeId;
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  // Attach the embedded-app session token when available (verified server-side).
  if (sessionTokenGetter) {
    const token = await sessionTokenGetter();
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

function withStore(params = {}) {
  const search = new URLSearchParams({ storeId: String(storeId) });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export const api = {
  getInstallStatus: (shop) => {
    const search = new URLSearchParams({ storeId: String(storeId) });
    if (shop) search.set('shop', shop);
    return request(`/install-status?${search.toString()}`);
  },

  getDashboard: () => request(`/dashboard?${withStore()}`),

  getBatches: () => request(`/batches?${withStore()}`),
  createBatch: (body) => request('/batches', { method: 'POST', body }),
  updateBatch: (id, body) => request(`/batches/${id}`, { method: 'PUT', body }),
  deleteBatch: (id) => request(`/batches/${id}`, { method: 'DELETE' }),

  getProducts: () => request(`/products?${withStore()}`),
  syncProducts: () => request(`/products/sync?${withStore()}`, { method: 'POST' }),

  getAlerts: () => request(`/alerts?${withStore()}`),
  createAlert: (body) => request('/alerts', { method: 'POST', body }),
  updateAlert: (id, body) => request(`/alerts/${id}`, { method: 'PUT', body }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),

  getLogs: ({ action, startDate, endDate, search, sortDir, limit, offset } = {}) =>
    request(`/logs?${withStore({ action, startDate, endDate, search, sortDir, limit, offset })}`),

  getNotifications: ({ limit = 10 } = {}) =>
    request(`/logs?${withStore({ limit, sortDir: 'desc' })}`),
};
