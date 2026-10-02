import { Clock, Bike, CheckCircle2, XCircle } from 'lucide-react';

export type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

const STATUS_LABELS: Record<OrderStatus, string> = {
  available: 'Looking for a rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function getStatusLabel(status: string): string {
  if (status in STATUS_LABELS) {
    return STATUS_LABELS[status as OrderStatus];
  }
  return 'Active order';
}

export const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  available: { label: getStatusLabel('available'), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  rider_assigned: { label: getStatusLabel('rider_assigned'), icon: Bike, color: 'text-blue-600', bg: 'bg-blue-50' },
  picked_up: { label: getStatusLabel('picked_up'), icon: Bike, color: 'text-[#7a1d1d]', bg: 'bg-[#7a1d1d]/10' },
  delivered: { label: getStatusLabel('delivered'), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: getStatusLabel('cancelled'), icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
};
