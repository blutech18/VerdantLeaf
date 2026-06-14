const STATUS_LABELS = {
  active: 'Ready to sell',
  warning: 'Check soon',
  critical: 'Action needed',
  expired: 'Expired',
  sold_out: 'Sold out',
};

const RULE_LABELS = {
  'low freshness': 'Low shelf-life alert',
  'low freshness warning': 'Low shelf-life alert',
  'critical stock': 'Urgent stock alert',
  'critical stock alert': 'Urgent stock alert',
  'near expiry emergency': 'Near-expiry alert',
};

function toNumber(value) {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractLotNumber(description = '') {
  return description.match(/batch\s+([A-Z]{2}-\d{4}-\d{3})/i)?.[1]
    || description.match(/Batch\s+([A-Z]{2}-\d{4}-\d{3})/i)?.[1]
    || null;
}

function extractRuleName(description = '') {
  return description.match(/Alert\s+"([^"]+)"/i)?.[1]
    || description.match(/Alert rule\s+"([^"]+)"/i)?.[1]
    || 'Alert';
}

function friendlyRuleName(name) {
  return RULE_LABELS[name?.toLowerCase()] || name || 'Alert';
}

export function formatStatusLabel(status) {
  return STATUS_LABELS[status] || String(status || '').replaceAll('_', ' ');
}

export function formatActivityText(entry) {
  const description = entry?.description || '';
  const metadata = entry?.metadata || {};
  const lotNumber = metadata.lotNumber || extractLotNumber(description);
  const productTitle = metadata.productTitle || metadata.product_title;

  // Build a friendly identifier: lot number > product title > generic
  const batchName = lotNumber 
    ? `Batch ${lotNumber}` 
    : productTitle 
      ? `${productTitle} batch`
      : 'Batch';

  switch (entry?.action) {
    case 'alert_triggered': {
      const ruleName = friendlyRuleName(metadata.ruleName || extractRuleName(description));
      return `${ruleName} triggered for ${batchName}. Shelf life is below threshold.`;
    }

    case 'discount_applied': {
      const discount = metadata.discount_percent
        || description.match(/of\s+(\d+)%/i)?.[1];
      return discount
        ? `${discount}% discount applied to ${batchName}.`
        : `Discount applied to ${batchName}.`;
    }

    case 'score_updated':
    case 'batch_expired': {
      const oldStatus = metadata.oldStatus || description.match(/:\s*([a-z_]+)\s*(?:->|→)/i)?.[1];
      const newStatus = metadata.newStatus || description.match(/(?:->|→)\s*([a-z_]+)/i)?.[1];
      const score = toNumber(metadata.newScore ?? metadata.score ?? description.match(/score:\s*([\d.]+)/i)?.[1]);

      if (oldStatus && newStatus) {
        const scoreCopy = score !== null ? ` (${score.toFixed(1)}% remaining)` : '';
        return `${batchName} status changed: ${formatStatusLabel(oldStatus)} → ${formatStatusLabel(newStatus)}${scoreCopy}`;
      }

      if (newStatus) {
        return `${batchName} marked as ${formatStatusLabel(newStatus)}.`;
      }

      return `${batchName} freshness updated.`;
    }

    case 'batch_created': {
      const quantity = metadata.quantity || description.match(/qty:\s*(\d+)/i)?.[1];
      if (quantity) {
        return productTitle 
          ? `New ${productTitle} batch added with ${quantity} units.`
          : `${batchName} added with ${quantity} units.`;
      }
      return productTitle 
        ? `New ${productTitle} batch added to inventory.`
        : `${batchName} added to inventory.`;
    }

    case 'batch_updated':
      if (metadata.isAddToCart) {
        return description;
      }
      return `${batchName} details updated.`;

    case 'batch_sold_out':
      return `${batchName} is now sold out.`;

    case 'rule_created':
    case 'rule_updated':
    case 'rule_deleted': {
      const ruleName = friendlyRuleName(metadata.ruleName || extractRuleName(description));
      const action = entry.action.split('_')[1];
      return `Alert rule "${ruleName}" was ${action}.`;
    }

    default:
      return description || 'Activity recorded.';
  }
}
