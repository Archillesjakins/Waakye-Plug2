const STATUS_LABELS: Record<string, string> = {
  available: 'Looking for a rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function customerOrderStatusLabel(status: string | undefined): string {
  if (!status) return 'Active order';
  return STATUS_LABELS[status] ?? 'Active order';
}
