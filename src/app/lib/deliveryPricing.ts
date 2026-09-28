import { distanceKm } from '@/app/lib/vendorMenu';

/** Short trips (≤ 3.5 km vendor → dropoff). */
export const DELIVERY_FEE_NEAR_GHS = 8;
/** 3.5 km < distance ≤ 4 km. */
export const DELIVERY_FEE_MID_GHS = 10;
/** Distance > 4 km. */
export const DELIVERY_FEE_FAR_GHS = 15;

export function deliveryFeeForDistanceKm(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km) || km < 0) return DELIVERY_FEE_NEAR_GHS;
  if (km <= 3.5) return DELIVERY_FEE_NEAR_GHS;
  if (km <= 4) return DELIVERY_FEE_MID_GHS;
  return DELIVERY_FEE_FAR_GHS;
}

/** Straight-line km from vendor GPS to customer dropoff pin. */
export function dropoffDistanceKm(
  vendorLat: number | null | undefined,
  vendorLng: number | null | undefined,
  deliveryLat: number | null | undefined,
  deliveryLng: number | null | undefined
): number | null {
  if (
    vendorLat == null ||
    vendorLng == null ||
    deliveryLat == null ||
    deliveryLng == null ||
    !Number.isFinite(vendorLat) ||
    !Number.isFinite(vendorLng) ||
    !Number.isFinite(deliveryLat) ||
    !Number.isFinite(deliveryLng)
  ) {
    return null;
  }
  return Math.round(distanceKm(vendorLat, vendorLng, deliveryLat, deliveryLng) * 100) / 100;
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
