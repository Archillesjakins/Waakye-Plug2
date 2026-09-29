import { supabase } from '@/app/lib/supabase';
import { formatDeliveryCode, recallDeliveryCode } from '@/app/lib/deliveryCode';

export type CustomerOrder = {
  id: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  updated_at: string | null;
  payment_method: string | null;
  delivery_code: string | null;
  items: { id: string; name: string; price: number; category: string; quantity: number }[] | null;
  vendors: { business_name: string } | null;
  riders: { profiles: { full_name: string; phone: string | null } | null } | null;
};

const ORDER_DETAIL_SELECT =
  'id, status, total_amount, delivery_address, created_at, picked_up_at, delivered_at, updated_at, payment_method, delivery_code, items, vendors(business_name), riders(profiles(full_name, phone))';

const ORDER_DETAIL_SELECT_NO_CODE =
  'id, status, total_amount, delivery_address, created_at, picked_up_at, delivered_at, updated_at, payment_method, items, vendors(business_name), riders(profiles(full_name, phone))';

function attachCachedDeliveryCode(order: CustomerOrder | null): CustomerOrder | null {
  if (!order) return null;
  if (formatDeliveryCode(order.delivery_code)) return order;
  const cached = recallDeliveryCode(order.id);
  if (!cached) return order;
  return { ...order, delivery_code: cached };
}

async function selectOrderById(orderId: string, select: string) {
  return supabase.from('orders').select(select).eq('id', orderId).maybeSingle();
}

export async function fetchOrderById(orderId: string): Promise<CustomerOrder | null> {
  let { data, error } = await selectOrderById(orderId, ORDER_DETAIL_SELECT);

  if (
    error?.code === 'PGRST204' &&
    typeof error.message === 'string' &&
    error.message.includes('delivery_code')
  ) {
    ({ data, error } = await selectOrderById(orderId, ORDER_DETAIL_SELECT_NO_CODE));
  }

  if (error) throw error;
  return attachCachedDeliveryCode((data ?? null) as unknown as CustomerOrder | null);
}

export async function fetchMyOrders(customerId: string): Promise<CustomerOrder[]> {
  let { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (
    error?.code === 'PGRST204' &&
    typeof error.message === 'string' &&
    error.message.includes('delivery_code')
  ) {
    ({ data, error } = await supabase
      .from('orders')
      .select(ORDER_DETAIL_SELECT_NO_CODE)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }));
  }

  if (error) throw error;
  return ((data ?? []) as unknown as CustomerOrder[]).map((o) => attachCachedDeliveryCode(o)!);
}
