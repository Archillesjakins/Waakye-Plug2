/** Random 4-digit code (1000–9999) for customer ↔ rider handoff at dropoff. */
export function generateDeliveryCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function formatDeliveryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, '');
  if (digits.length !== 4) return null;
  return digits;
}

export function isActiveDeliveryCodeStatus(status: string): boolean {
  return status === 'available' || status === 'rider_assigned' || status === 'picked_up';
}
