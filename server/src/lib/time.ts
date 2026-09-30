import { env } from '../config/env';

/**
 * Get current server time — the ONLY clock used for decisions.
 */
export function now(): Date {
  return new Date();
}

/**
 * Format a UTC date to a human-readable string in the configured timezone.
 */
export function formatInTimezone(date: Date): string {
  return date.toLocaleString('en-IN', { timeZone: env.APP_TIMEZONE });
}

/**
 * Format a UTC date to a time-only string (e.g. "10:05 AM").
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    timeZone: env.APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a UTC date to a date-only string (e.g. "30-Sep-2026").
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: env.APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Add minutes to a date.
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Get the start of day (midnight) in the configured timezone, returned as UTC.
 */
export function startOfDayInTz(date: Date): Date {
  const str = date.toLocaleDateString('en-CA', { timeZone: env.APP_TIMEZONE }); // YYYY-MM-DD
  return new Date(`${str}T00:00:00.000+05:30`); // TODO: dynamic offset
}

/**
 * Check if a date is in the future.
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > now().getTime();
}
