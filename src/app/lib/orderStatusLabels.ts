import { Clock, Bike, CheckCircle2, XCircle } from 'lucide-react';

export type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

// Single source of truth for customer-facing order status copy.
const STATUS_LABELS: Record<OrderStatus, string> = {
  available: 'Looking for a rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const UNKNOWN_STATUS_LABEL = 'Active order';

// Own-property check so inherited keys like 'toString' or 'constructor'
// are never treated as a known status.
export function isOrderStatus(status: string | null | undefined): status is OrderStatus {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(STATUS_LABELS, status);
}

export function orderStatusLabel(status: string | null | undefined): string {
  return isOrderStatus(status) ? STATUS_LABELS[status] : UNKNOWN_STATUS_LABEL;
}

/** @deprecated Use orderStatusLabel. Kept as an alias for existing callers. */
export const getStatusLabel = orderStatusLabel;

export const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  available: { label: STATUS_LABELS.available, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  rider_assigned: { label: STATUS_LABELS.rider_assigned, icon: Bike, color: 'text-blue-600', bg: 'bg-blue-50' },
  picked_up: { label: STATUS_LABELS.picked_up, icon: Bike, color: 'text-[#7a1d1d]', bg: 'bg-[#7a1d1d]/10' },
  delivered: { label: STATUS_LABELS.delivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: STATUS_LABELS.cancelled, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
};
