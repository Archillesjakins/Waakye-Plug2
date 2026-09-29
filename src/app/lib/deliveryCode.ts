/** Random 4-digit numeric code (0000–9999) for customer ↔ rider handoff at dropoff. */
export function generateDeliveryCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

export function formatDeliveryCode(code: string | number | null | undefined): string | null {
  if (code == null || code === '') return null;
  const digits = String(code).replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length > 4) return digits.slice(-4);
  return digits.padStart(4, '0');
}

export function isActiveDeliveryCodeStatus(status: string): boolean {
  return status === 'available' || status === 'rider_assigned' || status === 'picked_up';
}

const STORAGE_PREFIX = 'waakye_delivery_code_';

export function rememberDeliveryCode(orderId: string, code: string) {
  if (!orderId || !formatDeliveryCode(code)) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + orderId, formatDeliveryCode(code)!);
  } catch {
    /* private mode / quota */
  }
}

export function recallDeliveryCode(orderId: string): string | null {
  try {
    return formatDeliveryCode(sessionStorage.getItem(STORAGE_PREFIX + orderId));
  } catch {
    return null;
  }
}
