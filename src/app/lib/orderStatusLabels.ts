import { Clock, Bike, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';

/** Canonical order status keys (DB check constraint). */
export type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

/**
 * Canonical display labels — keep in sync across vendor / rider / customer apps.
 * Exact casing matters for Story 2 unification.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  available: 'Looking for a rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const LEGACY_TO_CANONICAL: Record<string, OrderStatus> = {
  ready: 'available',
  pending: 'available',
  accepted: 'available',
  preparing: 'available',
};

export function getStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Active order';
  if (Object.hasOwn(ORDER_STATUS_LABELS, status)) {
    return ORDER_STATUS_LABELS[status as OrderStatus];
  }
  const mapped = LEGACY_TO_CANONICAL[status];
  if (mapped) return ORDER_STATUS_LABELS[mapped];
  return 'Active order';
}


/** Alias of getStatusLabel for callers expecting orderStatusLabel. */
export const orderStatusLabel = getStatusLabel;
/** @deprecated Prefer getStatusLabel — kept for ActiveOrderHandoffBar and older imports. */
export function customerOrderStatusLabel(status: string | undefined): string {
  return getStatusLabel(status);
}

export type StatusVisual = {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

/** Badge visuals for My Orders (and similar list UIs). Labels come from ORDER_STATUS_LABELS. */
export const STATUS_CONFIG: Record<string, StatusVisual> = {
  available: {
    label: ORDER_STATUS_LABELS.available,
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  rider_assigned: {
    label: ORDER_STATUS_LABELS.rider_assigned,
    icon: Bike,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  picked_up: {
    label: ORDER_STATUS_LABELS.picked_up,
    icon: Bike,
    color: 'text-[#7a1d1d]',
    bg: 'bg-[#7a1d1d]/10',
  },
  delivered: {
    label: ORDER_STATUS_LABELS.delivered,
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  cancelled: {
    label: ORDER_STATUS_LABELS.cancelled,
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  // Legacy aliases share available visuals
  ready: {
    label: ORDER_STATUS_LABELS.available,
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  pending: {
    label: ORDER_STATUS_LABELS.available,
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
};

export function getStatusConfig(status: string | undefined | null): StatusVisual {
  if (status && Object.hasOwn(STATUS_CONFIG, status)) return STATUS_CONFIG[status];
  return {
    label: getStatusLabel(status),
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  };
}
