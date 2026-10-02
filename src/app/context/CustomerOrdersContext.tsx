'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchMyOrders, fetchOrderById, type CustomerOrder } from '@/app/lib/customerOrders';
import { reconcileActiveOrderHandoffFromOrders } from '@/app/lib/deliveryCode';

type CustomerOrdersContextValue = {
  orders: CustomerOrder[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getOrderDetail: (orderId: string) => CustomerOrder | null;
  ensureOrderDetail: (orderId: string) => Promise<CustomerOrder | null>;
};

const CustomerOrdersContext = createContext<CustomerOrdersContextValue | null>(null);

function upsertOrder(list: CustomerOrder[], row: CustomerOrder): CustomerOrder[] {
  const idx = list.findIndex((o) => o.id === row.id);
  if (idx === -1) return [row, ...list];
  const next = [...list];
  next[idx] = row;
  return next;
}

type ProviderProps = {
  userId: string;
  onHandoffChange?: () => void;
  children: ReactNode;
};

/** One Supabase channel per customer — order list + detail stay live without reload. */
export function CustomerOrdersProvider({ userId, onHandoffChange, children }: ProviderProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [details, setDetails] = useState<Record<string, CustomerOrder>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflightDetail = useRef(new Set<string>());

  const applyOrders = useCallback(
    (next: CustomerOrder[]) => {
      setOrders(next);
      if (reconcileActiveOrderHandoffFromOrders(next)) onHandoffChange?.();
    },
    [onHandoffChange],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchMyOrders(userId);
      applyOrders(data);
      setError(null);
    } catch (err) {
      console.error('Could not load orders', err);
      setError('Could not load your orders right now.');
    }
  }, [userId, applyOrders]);

  const refreshOrderById = useCallback(
    async (orderId: string) => {
      if (!orderId || inflightDetail.current.has(orderId)) return null;
      inflightDetail.current.add(orderId);
      try {
        const row = await fetchOrderById(orderId);
        if (!row) return null;
        setDetails((prev) => ({ ...prev, [orderId]: row }));
        setOrders((prev) => {
          const merged = upsertOrder(prev, row);
          if (reconcileActiveOrderHandoffFromOrders(merged)) onHandoffChange?.();
          return merged;
        });
        return row;
      } catch (err) {
        console.error('Could not refresh order', orderId, err);
        return null;
      } finally {
        inflightDetail.current.delete(orderId);
      }
    },
    [onHandoffChange],
  );

  const ensureOrderDetail = useCallback(
    async (orderId: string) => {
      const cached = details[orderId] ?? orders.find((o) => o.id === orderId);
      if (cached) return cached;
      return refreshOrderById(orderId);
    },
    [details, orders, refreshOrderById],
  );

  const getOrderDetail = useCallback(
    (orderId: string) => details[orderId] ?? orders.find((o) => o.id === orderId) ?? null,
    [details, orders],
  );

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        (payload) => {
          const id =
            (payload.new as { id?: string } | undefined)?.id ??
            (payload.old as { id?: string } | undefined)?.id;
          if (id) void refreshOrderById(id);
          else void refresh();
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh, refreshOrderById]);

  const value = useMemo(
    () => ({
      orders,
      loading,
      error,
      refresh,
      getOrderDetail,
      ensureOrderDetail,
    }),
    [orders, loading, error, refresh, getOrderDetail, ensureOrderDetail],
  );

  return <CustomerOrdersContext.Provider value={value}>{children}</CustomerOrdersContext.Provider>;
}

export function useCustomerOrders() {
  const ctx = useContext(CustomerOrdersContext);
  if (!ctx) throw new Error('useCustomerOrders must be used within CustomerOrdersProvider');
  return ctx;
}

/** Live order detail for Confirmation / tracking — updates when the shared channel fires. */
export function useLiveOrderDetail(orderId: string | null) {
  const { getOrderDetail, ensureOrderDetail } = useCustomerOrders();

  useEffect(() => {
    if (!orderId) return;
    void ensureOrderDetail(orderId);
  }, [orderId, ensureOrderDetail]);

  if (!orderId) return null;
  return getOrderDetail(orderId);
}
