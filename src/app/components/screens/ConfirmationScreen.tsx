'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Check, XCircle } from 'lucide-react';
import { useCart } from '@/app/context/CartContext';
import { useLiveOrderDetail } from '@/app/context/CustomerOrdersContext';
import type { CustomerOrder } from '@/app/lib/customerOrders';
import { DeliveryCodeCard } from '@/app/components/DeliveryCodeCard';
import { MenuItemThumbnail } from '@/app/components/MenuItemThumbnail';
import {
  clearActiveOrderHandoff,
  formatDeliveryCode,
  isOrderHandoffComplete,
  recallDeliveryCode,
  rememberActiveOrderHandoff,
  rememberDeliveryCode,
} from '@/app/lib/deliveryCode';

const BRAND = '#7a1d1d';
interface ConfirmationScreenProps {
  orderId: string | null;
  /** From checkout — shown immediately even before order fetch completes. */
  initialDeliveryCode?: string | null;
  onDone: () => void;
  /** Browse menu — active order + code stay saved until delivered. */
  onBack?: () => void;
  onHandoffChange?: () => void;
}

type OrderStatus = 'available' | 'rider_assigned' | 'picked_up' | 'delivered' | 'cancelled';

const TIMELINE_STEPS: {
  label: string;
  description: string;
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

export function ConfirmationScreen({ orderId, initialDeliveryCode, onDone, onBack, onHandoffChange }: ConfirmationScreenProps) {
  const { lines, totalPrice } = useCart();
  const order = useLiveOrderDetail(orderId);
  const status = (order?.status ?? 'available') as OrderStatus;
  const pinnedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (orderId && order?.delivery_code) rememberDeliveryCode(orderId, order.delivery_code);
  }, [orderId, order?.delivery_code]);

  const deliveryCode = useMemo(() => {
    if (!orderId) return pinnedCodeRef.current;
    const next =
      formatDeliveryCode(order?.delivery_code) ??
      formatDeliveryCode(initialDeliveryCode) ??
      recallDeliveryCode(orderId) ??
      pinnedCodeRef.current;
    if (next) pinnedCodeRef.current = next;
    return next;
  }, [orderId, order?.delivery_code, initialDeliveryCode]);

  useEffect(() => {
    if (!orderId || !deliveryCode) return;
    if (isOrderHandoffComplete(status, order?.delivered_at)) {
      clearActiveOrderHandoff(orderId);
      onHandoffChange?.();
      return;
    }
    rememberActiveOrderHandoff(orderId, deliveryCode, status);
    onHandoffChange?.();
  }, [orderId, deliveryCode, status, onHandoffChange]);

  const cancelled = status === 'cancelled';
  const activeStep = cancelled ? 0 : statusToStepIndex(status);
  const showDeliveryHandoff = !!orderId && !cancelled && status !== 'delivered';

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

  return (
    <div className="min-h-[100dvh] bg-[#fefaf4] flex flex-col [webkit-tap-highlight-color:transparent]">
      <div
        className="text-white px-4 pt-[max(env(safe-area-inset-top),12px)] pb-4 shadow-md"
        style={{ backgroundColor: BRAND }}
      >
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack ?? onDone}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={onBack ? 'Continue browsing' : 'Back'}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center pr-8">
            <h1 className="font-bold text-lg">Order details</h1>
            {showDeliveryHandoff && deliveryCode && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/85 mt-0.5">
                Your rider needs this code at dropoff
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto w-full px-4 py-5 pb-8 space-y-5">
        {showDeliveryHandoff && (
          <section aria-label="Delivery confirmation code">
            {deliveryCode ? (
              <DeliveryCodeCard code={deliveryCode} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                Loading your delivery code… If this stays blank, open <span className="font-bold">My Orders</span> or
                place the order again after updating the app.
              </div>
            )}
          </section>
        )}

        {cancelled ? (
          <div className="bg-white rounded-2xl border border-red-100 p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-bold text-lg text-gray-900">Order cancelled</h2>
            <p className="text-sm text-gray-500 mt-2">The vendor cancelled this order. Contact them if you need help.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {orderId && (
              <p className="text-xs text-gray-400 mb-4">
                Order #{shortOrderRef(orderId)}
                {order?.created_at ? ` · ${formatStepTime(order.created_at)}` : ''}
              </p>
            )}

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
                        className="absolute left-[11px] top-6 bottom-0 w-0.5"
                        style={{ backgroundColor: isComplete ? BRAND : '#e5e7eb' }}
                      />
                    )}

                    <div
                      className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isFuture ? 'bg-gray-200 text-gray-400' : isCurrent ? 'bg-[#faf6ee] text-white' : 'text-white'
                      }`}
                      style={
                        isComplete
                          ? { backgroundColor: BRAND }
                          : isCurrent
                            ? { boxShadow: `0 0 0 2px ${BRAND}` }
                            : undefined
                      }
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

        <div className="rounded-2xl p-4 text-white shadow-md" style={{ backgroundColor: BRAND }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80 mb-3">Your order</p>
          <div className="bg-white rounded-xl p-3 text-gray-900 space-y-3">
            <p className="text-xs font-bold" style={{ color: BRAND }}>
              {vendorName}
            </p>
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
              <span className="font-bold" style={{ color: BRAND }}>
                GH₵{Number(displayTotal).toFixed(2)}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#faf6ee]"
                style={{ color: BRAND }}
              >
                {paymentLabel}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full bg-[#7a1d1d] hover:bg-[#6a1717] text-white py-4 rounded-2xl font-bold transition-colors shadow-md"
        >
          {status === 'delivered' ? 'Done' : 'View all orders'}
        </button>
      </div>
    </div>
  );
}
