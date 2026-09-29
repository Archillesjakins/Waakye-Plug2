'use client';

import { useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchMyOrders, fetchOrderStatusSnapshot } from '@/app/lib/customerOrders';
import {
  clearActiveOrderHandoff,
  isOrderHandoffComplete,
  recallActiveOrderHandoff,
  rememberActiveOrderHandoff,
} from '@/app/lib/deliveryCode';

type SyncArgs = {
  orderId: string | undefined;
  userId: string | undefined;
  onChange: () => void;
};

function applyStatus(orderId: string, status: string | undefined, deliveredAt: string | null | undefined, onChange: () => void) {
  if (isOrderHandoffComplete(status, deliveredAt)) {
    clearActiveOrderHandoff(orderId);
    onChange();
    return true;
  }

  const handoff = recallActiveOrderHandoff();
  if (handoff?.orderId === orderId && status && handoff.status !== status) {
    rememberActiveOrderHandoff(orderId, handoff.deliveryCode, status);
    onChange();
  }
  return false;
}

/** Keeps session handoff in sync with Supabase while the bottom bar is active (any screen). */
export function useActiveOrderHandoffStatusSync({ orderId, userId, onChange }: SyncArgs) {
  useEffect(() => {
    if (!orderId) return;

    let alive = true;

    async function syncFromServer() {
      try {
        const snapshot = await fetchOrderStatusSnapshot(orderId);
        if (!alive) return;

        if (snapshot) {
          applyStatus(orderId, snapshot.status, snapshot.delivered_at, onChange);
          return;
        }

        if (userId) {
          const orders = await fetchMyOrders(userId);
          if (!alive) return;
          const row = orders.find((o) => o.id === orderId);
          if (row) {
            applyStatus(orderId, row.status, row.delivered_at, onChange);
          }
        }
      } catch (err) {
        console.error('Could not sync active order status', err);
      }
    }

    syncFromServer();

    const channelName = userId ? `active-handoff-${userId}` : `active-handoff-id-${orderId}`;
    const filter = userId ? `customer_id=eq.${userId}` : `id=eq.${orderId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; delivered_at?: string | null };
          if (row?.id && row.id !== orderId) return;
          if (row?.id === orderId) {
            applyStatus(orderId, row.status, row.delivered_at ?? null, onChange);
            return;
          }
          void syncFromServer();
        },
      )
      .subscribe();

    const interval = setInterval(syncFromServer, 5_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncFromServer();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orderId, userId, onChange]);
}
