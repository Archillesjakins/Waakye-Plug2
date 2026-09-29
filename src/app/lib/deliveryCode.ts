/** Random 4-digit numeric code (0000–9999) for customer ↔ rider handoff at dropoff. */
export function generateDeliveryCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function formatDeliveryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length > 4) return digits.slice(-4);
  return digits.padStart(4, '0');
}

export function isActiveDeliveryCodeStatus(status: string): boolean {
  return status === 'available' || status === 'rider_assigned' || status === 'picked_up';
}
