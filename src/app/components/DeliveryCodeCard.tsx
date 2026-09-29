'use client';

import { formatDeliveryCode } from '@/app/lib/deliveryCode';

type DeliveryCodeCardProps = {
  code: string | null | undefined;
  compact?: boolean;
};

function DigitRow({ digits, size }: { digits: string; size: 'lg' | 'sm' }) {
  const box =
    size === 'lg'
      ? 'w-[3.25rem] h-[3.75rem] sm:w-16 sm:h-[4.25rem] text-3xl sm:text-4xl rounded-xl'
      : 'w-9 h-10 text-lg rounded-lg';

  return (
    <div className={`flex justify-center gap-1.5 sm:gap-2 ${size === 'lg' ? 'my-1' : ''}`}>
      {digits.split('').map((digit, i) => (
        <span
          key={`${digit}-${i}`}
          className={`${box} inline-flex items-center justify-center font-mono font-bold tabular-nums bg-white border-2 border-emerald-200 text-emerald-950 shadow-sm`}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}

export function DeliveryCodeCard({ code, compact = false }: DeliveryCodeCardProps) {
  const formatted = formatDeliveryCode(code);
  if (!formatted) return null;

  if (compact) {
    return <DigitRow digits={formatted} size="sm" />;
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/80 p-5 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80 mb-3">
        Delivery confirmation code
      </p>
      <DigitRow digits={formatted} size="lg" />
      <p className="text-xs text-emerald-800/70 mt-4 leading-relaxed">
        Show these four numbers to your rider at dropoff.
      </p>
    </div>
  );
}
