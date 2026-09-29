'use client';

import { useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { fetchOrderById } from '@/app/lib/customerOrders';
import {
  clearActiveOrderHandoff,
  recallActiveOrderHandoff,
  rememberActiveOrderHandoff,
} from '@/app/lib/deliveryCode';

/** Keeps session handoff in sync with Supabase while the bottom bar is active (any screen). */
export function useActiveOrderHandoffStatusSync(orderId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!orderId) return;

    let alive = true;

    async function syncFromServer() {
      try {
        const row = await fetchOrderById(orderId);
        if (!alive || !row) return;

        const status = row.status;
        if (status === 'delivered' || status === 'cancelled') {
          clearActiveOrderHandoff(orderId);
          onChange();
          return;
        }

        const handoff = recallActiveOrderHandoff();
        if (handoff?.orderId === orderId && handoff.status !== status) {
          rememberActiveOrderHandoff(orderId, handoff.deliveryCode, status);
          onChange();
        }
      } catch (err) {
        console.error('Could not sync active order status', err);
      }
    }

    syncFromServer();

    const channel = supabase
      .channel(`active-handoff-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => {
          syncFromServer();
        },
      )
      .subscribe();

    const interval = setInterval(syncFromServer, 20_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') syncFromServer();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orderId, onChange]);
}
