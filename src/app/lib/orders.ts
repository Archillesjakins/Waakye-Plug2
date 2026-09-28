import { supabase } from '@/app/lib/supabase';
import type { CartLine } from '@/app/context/CartContext';
import { quoteDeliveryFee } from '@/app/lib/deliveryPricing';
import { getVendorById } from '@/app/lib/vendorMenu';

export function flattenCartItems(lines: CartLine[]) {
  const merged: Record<string, { id: string; name: string; price: number; category: string; quantity: number }> = {};

  lines.forEach((line) => {
    line.items.forEach((item) => {
      const qty = item.quantity * line.quantity;
      if (merged[item.id]) {
        merged[item.id].quantity += qty;
      } else {
        merged[item.id] = { id: item.id, name: item.name, price: item.price, category: item.category, quantity: qty };
      }
    });
  });

  return Object.values(merged);
}

// Delivery-only — there's no pickup, so every order needs a real address
// and a customer-confirmed GPS pin (delivery_lat / delivery_lng) for rider nav.
export async function createOrder({
  customerId,
  vendorId,
  lines,
  totalAmount,
  deliveryAddress,
  paymentMethod,
  deliveryLat,
  deliveryLng,
  quotedDeliveryFee,
  quotedDistanceKm,
}: {
  customerId: string;
  vendorId: string;
  lines: CartLine[];
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: 'cash' | 'momo';
  deliveryLat: number;
  deliveryLng: number;
  /** Must match checkout UI (CartContext). */
  quotedDeliveryFee: number;
  quotedDistanceKm?: number | null;
}) {
  const items = flattenCartItems(lines);

  const vendor = await getVendorById(vendorId);
  const quoted = quoteDeliveryFee(
    vendor?.latitude ?? null,
    vendor?.longitude ?? null,
    deliveryLat,
    deliveryLng
  );
  const deliveryFee = quotedDeliveryFee;
  const distanceKm = quotedDistanceKm ?? quoted.distanceKm;

  const row: Record<string, unknown> = {
    customer_id: customerId,
    vendor_id: vendorId,
    items,
    total_amount: totalAmount,
    delivery_fee: deliveryFee,
    delivery_mode: 'delivery',
    delivery_address: deliveryAddress,
    payment_method: paymentMethod,
    delivery_lat: deliveryLat,
    delivery_lng: deliveryLng,
    status: 'available',
  };
  if (distanceKm != null) row.distance_km = distanceKm;

  let { data, error } = await supabase.from('orders').insert(row).select().single();

  // Live DB may lag behind app deploy — apply schema/migrations/20260928_orders_distance_km.sql
  if (
    error?.code === 'PGRST204' &&
    typeof error.message === 'string' &&
    error.message.includes('distance_km')
  ) {
    const { distance_km: _drop, ...withoutDistance } = row;
    ({ data, error } = await supabase.from('orders').insert(withoutDistance).select().single());
  }

  if (error) throw error;
  return data;
}
