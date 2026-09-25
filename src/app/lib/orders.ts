import { supabase } from '@/app/lib/supabase';
import type { CartLine } from '@/app/context/CartContext';

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

// Delivery-only — there's no pickup, so every order needs a real address.
export async function createOrder({
  customerId,
  vendorId,
  lines,
  totalAmount,
  deliveryAddress,
  paymentMethod,
  deliveryFee,
}: {
  customerId: string;
  vendorId: string;
  lines: CartLine[];
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: 'cash' | 'momo';
  deliveryFee: number;
}) {
  const items = flattenCartItems(lines);

  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      vendor_id: vendorId,
      items,
      total_amount: totalAmount,
      delivery_mode: 'delivery',
      delivery_address: deliveryAddress,
      payment_method: paymentMethod,
      status: 'available',
      delivery_fee: deliveryFee,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}