// Platform ordering window (Africa/Accra). Per-vendor hours: vendors.is_open + daily_* columns.

import { getGhanaMinutesSinceMidnight } from '@/app/lib/vendorHours';

/** Last orders before this time (Africa/Accra). Testing: 11:30 PM — revert to 21:00 for production. */
export const PLATFORM_CLOSE_HOUR = 23;
export const PLATFORM_CLOSE_MINUTE = 30;

export function getPlatformCloseMinutesSinceMidnight(): number {
  return PLATFORM_CLOSE_HOUR * 60 + PLATFORM_CLOSE_MINUTE;
}

export function formatPlatformCloseTimeLabel(): string {
  const h = PLATFORM_CLOSE_HOUR;
  const m = PLATFORM_CLOSE_MINUTE;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minPart = m === 0 ? ':00' : `:${String(m).padStart(2, '0')}`;
  return `${hour12}${minPart} ${period}`;
}

export interface PlatformOrderingStatus {
  isOpen: boolean;
  timeUntilClose: number;
  timeUntilOpen: number;
}

export const TEST_TIME: Date | null = null;
export const DEMO_MODE = false;

export function getNow(): Date {
  return TEST_TIME ? new Date(TEST_TIME) : new Date();
}

export function getPlatformOrderingStatus(): PlatformOrderingStatus {
  if (DEMO_MODE) {
    return {
      isOpen: true,
      timeUntilClose: 60 * 60 * 1000,
      timeUntilOpen: 0,
    };
  }

  const now = getNow();
  const currentMinutes = getGhanaMinutesSinceMidnight(now);
  const closeMinutes = getPlatformCloseMinutesSinceMidnight();

  const isOpen = currentMinutes < closeMinutes;

  let timeUntilClose = 0;
  let timeUntilOpen = 0;

  if (isOpen) {
    timeUntilClose = Math.max(0, (closeMinutes - currentMinutes) * 60 * 1000);
  } else {
    timeUntilOpen = Math.max(0, (24 * 60 - currentMinutes) * 60 * 1000);
  }

  return { isOpen, timeUntilClose, timeUntilOpen };
}

/** @deprecated Use getPlatformOrderingStatus — kept for any stale imports */
export function checkOrderingStatus(): PlatformOrderingStatus {
  return getPlatformOrderingStatus();
}

export function canPlaceOrders(platformOpen: boolean, vendorIsOpen: boolean): boolean {
  return platformOpen && vendorIsOpen;
}

export function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
