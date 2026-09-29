import { supabase } from '@/app/lib/supabase';

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

export async function fetchOrderById(orderId: string): Promise<CustomerOrder | null> {
  const { data, error } = await supabase.from('orders').select(ORDER_DETAIL_SELECT).eq('id', orderId).maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as CustomerOrder | null;
}

export async function fetchMyOrders(customerId: string): Promise<CustomerOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_SELECT)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as CustomerOrder[];
}