'use client';

import { Package } from 'lucide-react';
import { DeliveryCodeCard } from '@/app/components/DeliveryCodeCard';
import type { ActiveOrderHandoff } from '@/app/lib/deliveryCode';
import { customerOrderStatusLabel } from '@/app/lib/orderStatusLabels';

type ActiveOrderHandoffBarProps = {
  handoff: ActiveOrderHandoff;
  onOpenOrder: () => void;
  /** Leave room when cart chip is visible */
  cartVisible?: boolean;
};

export function ActiveOrderHandoffBar({ handoff, onOpenOrder, cartVisible }: ActiveOrderHandoffBarProps) {
  return (
    <button
      type="button"
      onClick={onOpenOrder}
      className={`fixed left-4 right-4 z-50 mx-auto max-w-md flex items-center gap-3 bg-[#7a1d1d] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/10 text-left active:scale-[0.99] transition-transform ${
        cartVisible ? 'bottom-24' : 'bottom-6'
      }`}
    >
      <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
        <Package className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-white/85">
          Active order — delivery code
        </span>
        <span className="block text-xs text-white/90 mt-0.5 truncate">
          {customerOrderStatusLabel(handoff.status)} · tap for full details
        </span>
      </span>
      <DeliveryCodeCard code={handoff.deliveryCode} compact />
    </button>
  );
}
