/**
 * FreshTrack — Activity presentation metadata
 * Maps each activity action to its icon, color class, and human label so the
 * dashboard feed and the full activity log stay visually consistent.
 */

import {
  PackageIcon, EditIcon, ChartIcon, BellIcon, DollarIcon, AlertTriangleIcon,
  CheckCircleIcon, SettingsIcon, TrashIcon, ClipboardIcon, CartIcon,
} from '../components/Icons';

const ACTION_META = {
  batch_created: { icon: PackageIcon, cls: 'create', label: 'Batch Created' },
  batch_updated: { icon: EditIcon, cls: 'update', label: 'Batch Updated' },
  score_updated: { icon: ChartIcon, cls: 'update', label: 'Shelf Life Updated' },
  alert_triggered: { icon: BellIcon, cls: 'alert', label: 'Alert Triggered' },
  discount_applied: { icon: DollarIcon, cls: 'create', label: 'Discount Applied' },
  batch_expired: { icon: AlertTriangleIcon, cls: 'expire', label: 'Batch Expired' },
  batch_sold_out: { icon: CheckCircleIcon, cls: 'create', label: 'Batch Sold Out' },
  rule_created: { icon: SettingsIcon, cls: 'update', label: 'Rule Created' },
  rule_updated: { icon: SettingsIcon, cls: 'update', label: 'Rule Updated' },
  rule_deleted: { icon: TrashIcon, cls: 'expire', label: 'Rule Deleted' },
};

const STOREFRONT_META = { icon: CartIcon, cls: 'create', label: 'Added to Cart' };
const FALLBACK_META = { icon: ClipboardIcon, cls: 'update', label: 'Activity' };

/**
 * Resolves icon/cls/label for a log entry, treating storefront add-to-cart
 * events (flagged in metadata) as their own type.
 */
export function getActivityMeta(entry, size = 16) {
  const base = entry?.metadata?.isAddToCart
    ? STOREFRONT_META
    : (ACTION_META[entry?.action] || FALLBACK_META);
  const Icon = base.icon;
  return { icon: <Icon size={size} />, cls: base.cls, label: base.label };
}
