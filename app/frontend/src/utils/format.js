/**
 * FreshTrack — Shared display formatters
 * Pure helpers reused across the dashboard, batch, and activity views.
 */

export const CATEGORY_LABELS = {
  green_tea: 'Green Tea',
  black_tea: 'Black Tea',
  oolong: 'Oolong',
  white_tea: 'White Tea',
  puerh: 'Pu-erh',
  herbal: 'Herbal',
  matcha: 'Matcha',
  other: 'Other',
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Builds a deep link to a product in the Shopify admin so a batch can be
 * traced back to its live catalog entry. Returns null when the product isn't
 * linked to Shopify or the store domain is unknown.
 */
export function shopifyAdminProductUrl(shopifyProductId, shopDomain) {
  if (!shopifyProductId) return null;
  const handle = String(shopDomain || '').replace(/\.myshopify\.com$/i, '').trim();
  if (!handle) return null;
  return `https://admin.shopify.com/store/${handle}/products/${shopifyProductId}`;
}

/** Color that mirrors the freshness status thresholds used server-side. */
export function getScoreColor(score) {
  const value = parseFloat(score);
  if (value >= 60) return '#27ae60';
  if (value >= 30) return '#f39c12';
  if (value > 0) return '#e74c3c';
  return '#95a5a6';
}

export function timeAgo(dateStr) {
  // Backend sometimes sends local time with a 'Z' suffix, causing future dates.
  // Stripping 'Z' ensures the browser parses it as local time instead.
  const cleanDateStr = typeof dateStr === 'string' && dateStr.endsWith('Z')
    ? dateStr.slice(0, -1)
    : dateStr;
  
  let diff = Math.floor((Date.now() - new Date(cleanDateStr).getTime()) / 1000);
  if (diff < 0) diff = 0; // Guard against minor clock skew
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDateTime(dateStr) {
  const cleanDateStr = typeof dateStr === 'string' && dateStr.endsWith('Z')
    ? dateStr.slice(0, -1)
    : dateStr;
  const date = new Date(cleanDateStr);
  return (
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}
