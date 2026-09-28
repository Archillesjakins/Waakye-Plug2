import { distanceKm } from '@/app/lib/vendorMenu';

/** Vendor → dropoff ≤ 4 km (and default when distance unknown). */
export const DELIVERY_FEE_STANDARD_GHS = 10;
/** Vendor → dropoff > 4 km. */
export const DELIVERY_FEE_FAR_GHS = 15;

/** @deprecated Use DELIVERY_FEE_STANDARD_GHS */
export const DELIVERY_FEE_NEAR_GHS = DELIVERY_FEE_STANDARD_GHS;

/** PostgREST may return numeric columns as strings — normalize before distance math. */
export function parseCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function deliveryFeeForDistanceKm(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km) || km < 0) return DELIVERY_FEE_STANDARD_GHS;
  if (km <= 4) return DELIVERY_FEE_STANDARD_GHS;
  return DELIVERY_FEE_FAR_GHS;
}

/** Straight-line km from vendor GPS to customer dropoff pin. */
export function dropoffDistanceKm(
  vendorLat: number | null | undefined,
  vendorLng: number | null | undefined,
  deliveryLat: number | null | undefined,
  deliveryLng: number | null | undefined
): number | null {
  const vLat = parseCoord(vendorLat);
  const vLng = parseCoord(vendorLng);
  const dLat = parseCoord(deliveryLat);
  const dLng = parseCoord(deliveryLng);
  if (vLat == null || vLng == null || dLat == null || dLng == null) {
    return null;
  }
  return Math.round(distanceKm(vLat, vLng, dLat, dLng) * 100) / 100;
}

export function quoteDeliveryFee(
  vendorLat: number | null | undefined,
  vendorLng: number | null | undefined,
  deliveryLat: number | null | undefined,
  deliveryLng: number | null | undefined
): { distanceKm: number | null; deliveryFee: number } {
  const d = dropoffDistanceKm(vendorLat, vendorLng, deliveryLat, deliveryLng);
  return { distanceKm: d, deliveryFee: deliveryFeeForDistanceKm(d) };
}
