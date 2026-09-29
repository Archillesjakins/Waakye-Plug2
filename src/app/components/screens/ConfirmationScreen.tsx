'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Check, XCircle } from 'lucide-react';
import { useCart } from '@/app/context/CartContext';
import { supabase } from '@/app/lib/supabase';
import { fetchOrderById, type CustomerOrder } from '@/app/lib/customerOrders';
import { DeliveryCodeCard } from '@/app/components/DeliveryCodeCard';
import { MenuItemThumbnail } from '@/app/components/MenuItemThumbnail';

interface ConfirmationScreenProps {
  orderId: string | null;
  /** From checkout — shown immediately even before order fetch completes. */
  initialDeliveryCode?: string | null;
  onDone: () => void;
  onBack?: () => void;
}

type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

const TIMELINE_STEPS: {
  label: string;
  description: string;
  /** Shown when this step is the current one (in progress). */
  activeDescription: string;
}[] = [
  {
    label: 'Order placed',
    description: 'Your order was placed for delivery.',
    activeDescription: 'We’re finding a rider for your order.',
  },
  {
    label: 'Rider assigned',
    description: 'A rider accepted your order.',
    activeDescription: 'Your rider is heading to the vendor.',
  },
  {
    label: 'On the way',
    description: 'Your rider picked up the food.',
    activeDescription: 'Your order is on the way — keep your phone close.',
  },
  {
    label: 'Delivered',
    description: 'Your order was delivered. Enjoy!',
    activeDescription: 'Almost there…',
  },
];

function statusToStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'available':
      return 0;
    case 'rider_assigned':
      return 1;
    case 'picked_up':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

function formatStepTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function stepTimestamp(order: CustomerOrder, stepIndex: number): string | null {
  if (stepIndex === 0) return formatStepTime(order.created_at);
  if (stepIndex === 1 && statusToStepIndex(order.status as OrderStatus) >= 1) {
    return formatStepTime(order.updated_at);
  }
  if (stepIndex === 2) return formatStepTime(order.picked_up_at);
  if (stepIndex === 3) return formatStepTime(order.delivered_at);
  return null;
}

function shortOrderRef(id: string): string {
  return id.replace(/-/g, '').slice(-4).toUpperCase();
}

export function ConfirmationScreen({ orderId, initialDeliveryCode, onDone, onBack }: ConfirmationScreenProps) {
  const { lines, totalPrice } = useCart();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [status, setStatus] = useState<OrderStatus>('available');

  useEffect(() => {
    if (!orderId) return;

    let alive = true;

    async function load() {
      try {
        const row = await fetchOrderById(orderId);
        if (!alive || !row) return;
        setOrder(row);
        setStatus(row.status as OrderStatus);
      } catch (err) {
        console.error('Could not load order', err);
      }
    }

    load();

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const cancelled = status === 'cancelled';
  const activeStep = cancelled ? 0 : statusToStepIndex(status);

  const displayItems =
    order?.items && order.items.length > 0
      ? order.items
      : lines.flatMap((line) =>
          line.items.map((item) => ({
            ...item,
            quantity: item.quantity * line.quantity,
          }))
        );

  const displayTotal = order?.total_amount ?? totalPrice;
  const vendorName = order?.vendors?.business_name ?? 'Your order';
  const paymentLabel =
    order?.payment_method === 'momo' ? 'MoMo' : order?.payment_method === 'cash' ? 'Cash' : 'Paid';

  const deliveryCode = order?.delivery_code ?? initialDeliveryCode ?? null;
  const showDeliveryCode = !cancelled && status !== 'delivered' && !!deliveryCode;

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col [webkit-tap-highlight-color:transparent]">
      {/* Header — full-width bar like reference “Order details” */}
      <div className="bg-emerald-600 text-white px-4 pt-[max(env(safe-area-inset-top),12px)] pb-4 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack ?? onDone}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center pr-8">
            <h1 className="font-bold text-lg">Order details</h1>
            {showDeliveryCode && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80 mt-0.5">
                Tell your rider this code at dropoff
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-8">
        {showDeliveryCode && (
          <div className="mb-6 -mt-2">
            <DeliveryCodeCard code={deliveryCode} />
          </div>
        )}

        {cancelled ? (
          <div className="bg-white rounded-2xl border border-red-100 p-6 text-center mb-6">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-bold text-lg text-gray-900">Order cancelled</h2>
            <p className="text-sm text-gray-500 mt-2">The vendor cancelled this order. Contact them if you need help.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            {orderId && (
              <p className="text-xs text-gray-400 mb-4">
                Order #{shortOrderRef(orderId)}
                {order?.created_at ? ` · ${formatStepTime(order.created_at)}` : ''}
              </p>
            )}

            {/* Vertical timeline (reference-style) */}
            <div className="relative pl-14">
              {TIMELINE_STEPS.map((step, i) => {
                const isComplete = i < activeStep || status === 'delivered';
                const isCurrent = i === activeStep && status !== 'delivered' && !cancelled;
                const isFuture = !isComplete && !isCurrent;
                const time = order ? stepTimestamp(order, i) : i === 0 ? formatStepTime(new Date().toISOString()) : null;
                const showTime = isComplete && time;

                return (
                  <div key={step.label} className={`relative flex gap-3 ${i < TIMELINE_STEPS.length - 1 ? 'pb-8' : ''}`}>
                    {showTime && (
                      <span className="absolute -left-14 top-0 w-12 text-right text-[11px] font-medium text-gray-400 tabular-nums">
                        {time}
                      </span>
                    )}

                    {i < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${
                          isComplete ? 'bg-emerald-500' : 'bg-gray-200'
                        }`}
                      />
                    )}

                    <div
                      className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-emerald-100 ring-2 ring-emerald-500 text-emerald-700'
                            : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isComplete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                    </div>

                    <div className="min-w-0 pt-0.5">
                      <p className={`font-bold text-sm ${isFuture ? 'text-gray-400' : 'text-gray-900'}`}>{step.label}</p>
                      <p className={`text-xs mt-1 leading-relaxed ${isFuture ? 'text-gray-300' : 'text-gray-500'}`}>
                        {isCurrent ? step.activeDescription : step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order items — green footer block like reference */}
        <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80 mb-3">Description</p>
          <div className="bg-white rounded-xl p-3 text-gray-900 space-y-3">
            <p className="text-xs font-bold text-emerald-800">{vendorName}</p>
            {displayItems.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="flex items-center gap-3">
                <MenuItemThumbnail
                  imageUrl={'imageUrl' in item ? (item as { imageUrl?: string }).imageUrl : undefined}
                  category={'category' in item ? item.category : 'combo'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {item.name}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">GH₵{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-bold text-emerald-700">GH₵{Number(displayTotal).toFixed(2)}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                {paymentLabel}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full mt-6 bg-[#7a1d1d] text-white py-4 rounded-2xl font-bold hover:bg-[#6a1717] transition-colors shadow-md"
        >
          {status === 'delivered' ? 'Done' : 'View all orders'}
        </button>
      </div>
    </div>
  );
}
