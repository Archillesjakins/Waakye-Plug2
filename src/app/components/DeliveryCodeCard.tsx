'use client';

import { formatDeliveryCode } from '@/app/lib/deliveryCode';

type DeliveryCodeCardProps = {
  code: string | null | undefined;
  compact?: boolean;
};

export function DeliveryCodeCard({ code, compact = false }: DeliveryCodeCardProps) {
  const formatted = formatDeliveryCode(code);
  if (!formatted) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[#7a1d1d] tracking-[0.2em] text-sm">
        {formatted}
      </span>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/80 p-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80 mb-2">
        Delivery confirmation code
      </p>
      <p className="font-mono text-4xl font-bold tracking-[0.35em] text-emerald-900 tabular-nums">{formatted}</p>
      <p className="text-xs text-emerald-800/70 mt-3 leading-relaxed">
        Show this code to your rider at dropoff so they know it&apos;s your order.
      </p>
    </div>
  );
}
