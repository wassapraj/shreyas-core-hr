import { format, addMonths as fnsAddMonths, parseISO } from 'date-fns';

/**
 * Format date to dd-MMM-yyyy format
 */
export function fmtDate(dateISO: string | null, fallback: string = '—'): string {
  if (!dateISO) return fallback;
  
  try {
    const date = typeof dateISO === 'string' ? parseISO(dateISO) : dateISO;
    return format(date, 'dd-MMM-yyyy');
  } catch {
    return fallback;
  }
}

/**
 * Add months to a date
 */
export function addMonths(dateISO: string, n: number): string {
  try {
    const date = parseISO(dateISO);
    const newDate = fnsAddMonths(date, n);
    return newDate.toISOString().split('T')[0]; // Return as YYYY-MM-DD
  } catch {
    return dateISO;
  }
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if date is in the past
 */
export function isPast(dateISO: string): boolean {
  try {
    const date = parseISO(dateISO);
    return date < new Date();
  } catch {
    return false;
  }
}

/**
 * Format date for display (user-friendly)
 */
export function formatDisplayDate(dateISO: string | null): string {
  if (!dateISO) return '—';
  
  try {
    const date = parseISO(dateISO);
    return format(date, 'dd MMM yyyy');
  } catch {
    return '—';
  }
}