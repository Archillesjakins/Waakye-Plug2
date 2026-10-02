/** Postgres `time` / Supabase string, e.g. "08:30:00" or "08:30". */
export type DailyTime = string | null | undefined;

function parseTimeToMinutes(value: DailyTime): number | null {
  if (value == null || value === '') return null;
  const raw = typeof value === 'string' ? value.trim() : String(value);
  const part = raw.split(':');
  if (part.length < 2) return null;
  const h = Number(part[0]);
  const m = Number(parseInt(part[1], 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Minutes since midnight in Ghana (Africa/Accra), matching admin copy. */
export function getGhanaMinutesSinceMidnight(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Without both times set, the vendor is not orderable on the customer app. */
export function isWithinDailyHours(
  opensAt: DailyTime,
  closesAt: DailyTime,
  now: Date = new Date()
): boolean {
  const openMin = parseTimeToMinutes(opensAt);
  const closeMin = parseTimeToMinutes(closesAt);
  if (openMin == null || closeMin == null) return false;

  const currentMin = getGhanaMinutesSinceMidnight(now);

  if (closeMin > openMin) {
    return currentMin >= openMin && currentMin < closeMin;
  }
  // Overnight window (e.g. 22:00 → 02:00)
  return currentMin >= openMin || currentMin < closeMin;
}

export function vendorAcceptingOrders(vendor: {
  is_open: boolean;
  daily_opens_at?: DailyTime;
  daily_closes_at?: DailyTime;
}): boolean {
  return vendor.is_open && isWithinDailyHours(vendor.daily_opens_at, vendor.daily_closes_at);
}

/** `HH:MM` for `<input type="time">` from a Postgres time string. */
export function toTimeInputValue(value: DailyTime): string {
  if (!value) return '';
  const [h, m] = value.split(':');
  if (!h || !m) return '';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** Save to Postgres: "HH:MM:00" */
export function fromTimeInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [h, m] = trimmed.split(':');
  if (!h || !m) return null;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
}

export function formatDailyTimeLabel(value: DailyTime): string {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return '—';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}
