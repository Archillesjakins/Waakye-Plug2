'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, PartyPopper, Clock, Bike, Home, XCircle } from 'lucide-react';
import { useCart, CartLine, lineUnitPrice } from '@/app/context/CartContext';
import { supabase } from '@/app/lib/supabase';

interface ConfirmationScreenProps {
  orderId: string | null;
  onDone: () => void;
}

// The real status lifecycle, matching what the system actually writes:
// customer inserts 'available'; rider app writes 'rider_assigned',
// 'picked_up', 'delivered'; vendor app writes 'cancelled'. ('pending' /
// 'accepted' / 'preparing' / 'ready' are ghosts — nothing in any app ever
// wrote them.)
type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

// Canonical steps shown in the tracker, in lifecycle order.
const STATUS_STEPS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: 'available', label: 'Order Sent', icon: Clock },
  { key: 'rider_assigned', label: 'Rider Assigned', icon: Check },
  { key: 'picked_up', label: 'On the way', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: Home },
];

// Legacy statuses an old row might still carry (pre-canonical-enum data).
// Map them onto the closest real step so the tracker never shows a wrong
// position; unknown statuses default to step 0.
const LEGACY_STEP_INDEX: Record<string, number> = {
  pending: 0,
  accepted: 0,
  preparing: 0,
  ready: 0,
};

export function ConfirmationScreen({ orderId, onDone }: ConfirmationScreenProps) {
  const { lines, totalPrice } = useCart();
  const [status, setStatus] = useState<OrderStatus>('available');

  // Live status — subscribes to this specific order row and updates the
  // instant the rider claims / picks up / delivers, or the vendor cancels.
  // Requires realtime replication enabled on the orders table in Supabase.
  useEffect(() => {
    if (!orderId) return;

    // Mount-time sync: if the user re-enters this screen (or reloads) after
    // the order has already progressed, start from the real current status
    // instead of always showing "Order Sent".
    let alive = true;
    supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        if (alive && data?.status) setStatus(data.status as OrderStatus);
      });

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as any)?.status as OrderStatus | undefined;
          if (next) setStatus(next);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const baseItem = (line: CartLine) => line.items.find((i) => i.category === 'base' || i.category === 'combo');
  const otherItems = (line: CartLine) => line.items.filter((i) => i.category !== 'base' && i.category !== 'combo');

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  // Step position for rendering: legacy statuses map through LEGACY_STEP_INDEX;
  // unknown statuses default to step 0. 'cancelled' is handled separately.
  const stepIndex =
    currentStepIndex >= 0
      ? currentStepIndex
      : (LEGACY_STEP_INDEX[status] ?? 0);

  function handleDone() {
    onDone();
  }

  // Friendly, status-aware header copy so re-entering the screen late shows
  // where things actually are, not a stale "Order Sent!".
  const HEADER_COPY: Record<OrderStatus, { title: string; icon: any; sub: string }> = {
    available: { title: 'Order Sent!', icon: PartyPopper, sub: 'We\u2019re lining up a rider \u2014 this updates live.' },
    rider_assigned: { title: 'Rider Assigned!', icon: Check, sub: 'Your rider has the order \u2014 food is on its way soon.' },
    picked_up: { title: 'On the Way!', icon: Bike, sub: 'Your rider has picked it up \u2014 keep your phone close.' },
    delivered: { title: 'Delivered!', icon: Home, sub: 'Enjoy your waakye \u2014 thanks for ordering!' },
    cancelled: { title: 'Order Cancelled', icon: XCircle, sub: 'This order was cancelled. Reach out to the vendor or support if you\u2019re not sure why.' },
  };
  const header = HEADER_COPY[status] ?? HEADER_COPY.available;
  const HeaderIcon = header.icon;

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] flex items-center justify-center px-4 py-6 [webkit-tap-highlight-color:transparent]">
      <div className="max-w-md w-full pb-[env(safe-area-inset-bottom)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 will-change-transform"
        >
          {status === 'cancelled' ? (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-center mb-1.5">Order Cancelled</h1>
              <p className="text-gray-500 text-center text-sm mb-5">
                This order was cancelled. Reach out to the vendor or support if you're not sure why.
              </p>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"
              >
                <HeaderIcon className="w-8 h-8 text-green-600" />
              </motion.div>

              <h1 className="text-2xl font-bold text-center mb-1.5">
                {header.title}
              </h1>
              <p className="text-gray-500 text-center text-sm mb-5">
                {header.sub}
              </p>

              {/* ── Live status tracker ── */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                <div className="flex items-center justify-between">
                  {STATUS_STEPS.map((step, i) => {
                    const isDone = i <= stepIndex;
                    const isCurrent = i === stepIndex;
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && (
                          <div
                            className={`absolute right-1/2 top-4 w-full h-0.5 -z-0 ${
                              i <= stepIndex ? 'bg-[#7a1d1d]' : 'bg-gray-200'
                            }`}
                          />
                        )}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors ${
                            isDone ? 'bg-[#7a1d1d] text-white' : 'bg-gray-200 text-gray-400'
                          } ${isCurrent ? 'ring-4 ring-[#7a1d1d]/20' : ''}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] mt-1.5 text-center font-medium ${isDone ? 'text-gray-800' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </>
          )}

          {/* ── Order recap ── */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100 space-y-3">
            <span className="text-sm font-bold text-gray-700">Your Order</span>
            {lines.map((line) => (
              <div key={line.id} className="text-sm">
                <div className="flex justify-between font-medium text-gray-800">
                  <span>{line.quantity}x {baseItem(line)?.name ?? 'Item'}</span>
                  <span>GH₵{lineUnitPrice(line) * line.quantity}</span>
                </div>
                {otherItems(line).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    + {otherItems(line).map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.name}` : i.name)).join(', ')}
                  </p>
                )}
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-gray-200 font-bold">
              <span>Total</span>
              <span className="text-[#7a1d1d]">GH₵{totalPrice}</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDone}
            className="w-full bg-[#7a1d1d] text-white py-4 rounded-2xl font-bold hover:bg-[#6a1717] transition-colors shadow-md"
          >
            Done
          </motion.button>
        </motion.div>

        <div className="text-center mt-5 text-sm text-gray-500 pb-[env(safe-area-inset-bottom)]">
          <p className="font-bold text-[#7a1d1d]">Waakye Plug</p>
          <p>Thanks for ordering! 🙏</p>
        </div>
      </div>
    </div>
  );
}