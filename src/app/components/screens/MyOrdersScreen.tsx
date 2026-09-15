'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Package, Bike, CheckCircle2, XCircle, Clock, Loader2, MapPin, RotateCcw } from 'lucide-react';
import { fetchMyOrders, type CustomerOrder } from '@/app/lib/customerOrders';
import { useUser } from '@/app/context/UserContext';
import { supabase } from '@/app/lib/supabase';

interface MyOrdersScreenProps {
  onBack: () => void;
  onOrderAgain?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Package; color: string; bg: string }> = {
  pending: { label: 'Order Placed', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
  available: { label: 'Looking for a Rider', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ready: { label: 'Looking for a Rider', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  rider_assigned: { label: 'Rider Assigned', icon: Bike, color: 'text-blue-600', bg: 'bg-blue-50' },
  picked_up: { label: 'On the Way', icon: Bike, color: 'text-[#7a1d1d]', bg: 'bg-[#7a1d1d]/10' },
  delivered: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' +
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function MyOrdersScreen({ onBack, onOrderAgain }: MyOrdersScreenProps) {
  const { userId } = useUser();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchMyOrders(userId);
        if (!cancelled) setOrders(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Could not load your orders right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Real-time: any change to this customer's own orders (a rider gets
    // assigned, picks up, delivers) shows up immediately, without needing
    // to reopen the screen.
    const channel = supabase
      .channel(`my-orders-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    // Fallback safety net in case the realtime connection ever drops.
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] [webkit-tap-highlight-color:transparent]">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button onClick={onBack} className="p-3 -ml-3 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">My Orders</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 text-[#7a1d1d] animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg text-center">{error}</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-sm text-gray-500">No orders yet</p>
            <p className="text-xs mt-1">Your orders will show up here once you place one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => {
              const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = config.icon;
              const riderName = order.riders?.profiles?.full_name;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-sm">{order.vendors?.business_name ?? 'Vendor'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-3">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{order.delivery_address}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    {riderName ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <Bike className="w-3.5 h-3.5 text-[#7a1d1d]" />
                        {riderName}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {order.status === 'cancelled' ? '—' : 'Waiting for a rider'}
                      </span>
                    )}
                    <span className="font-bold text-sm text-[#7a1d1d]">GH₵{order.total_amount}</span>
                  </div>

                  {onOrderAgain && (
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={onOrderAgain}
                        className="flex items-center gap-1.5 bg-[#7a1d1d]/5 text-[#7a1d1d] font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform hover:bg-[#7a1d1d]/10"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Order Again
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}