import type { Balances } from './fish-api';

export type Severity = 'normal' | 'warning' | 'error';

/** What the status bar shows for a set of balances. */
export interface Headline {
  /** Status bar text without the icon. */
  text: string;
  severity: Severity;
  /** Remaining plan credits as a percentage of the plan total, when known. */
  remainingPercent: number | undefined;
}

export function formatCredits(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
}

/**
 * Plan credits are what most users spend, so they lead; the pay-as-you-go
 * API credit is shown only when there is no plan.
 */
export function headline(balances: Balances, warningThresholdPercent: number, locale: string): Headline {
  const { plan, apiCredit } = balances;
  if (plan) {
    const remainingPercent = plan.total > 0 ? (plan.balance / plan.total) * 100 : undefined;
    const low = plan.balance <= 0 || (remainingPercent !== undefined && remainingPercent < warningThresholdPercent);
    return {
      text: formatCredits(plan.balance, locale),
      severity: low ? 'warning' : 'normal',
      remainingPercent,
    };
  }
  if (apiCredit) {
    return {
      text: formatUsd(apiCredit.credit, locale),
      severity: apiCredit.credit <= 0 ? 'warning' : 'normal',
      remainingPercent: undefined,
    };
  }
  return { text: '—', severity: 'warning', remainingPercent: undefined };
}

/** True when the last successful refresh is older than the interval. */
export function isStale(fetchedAt: Date | undefined, intervalMinutes: number, now: Date): boolean {
  return !fetchedAt || now.getTime() - fetchedAt.getTime() >= intervalMinutes * 60_000;
}

/** Keeps the setting inside the documented range even if settings.json says otherwise. */
export function clampInterval(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return 30;
  }
  return Math.min(1440, Math.max(5, minutes));
}
