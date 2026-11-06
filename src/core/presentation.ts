import type { Balances, PlanCredits } from './fish-api';

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

const DAY_MS = 86_400_000;

/**
 * When the plan credits are next refilled. Fish Audio refills them monthly
 * on a UTC day of the month (`anchor_day`, moved to the month's last day in
 * shorter months). Without an anchor day the day and time of `finished_at`
 * are used, then the day of `updated_at`. The time of day is taken from
 * `finished_at`, or midnight UTC. Undefined when nothing says which day.
 */
export function nextCreditReset(plan: PlanCredits, now: Date): Date | undefined {
  const day = plan.anchorDay ?? plan.finishedAt?.getUTCDate() ?? plan.updatedAt?.getUTCDate();
  if (day === undefined) {
    return undefined;
  }
  const hours = plan.finishedAt?.getUTCHours() ?? 0;
  const minutes = plan.finishedAt?.getUTCMinutes() ?? 0;
  const inMonth = (year: number, month: number): Date => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay), hours, minutes));
  };
  let reset = inMonth(now.getUTCFullYear(), now.getUTCMonth());
  if (reset.getTime() <= now.getTime()) {
    reset = inMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
  }
  // A plan that ends first gives no monthly refill after its end.
  if (plan.finishedAt && plan.finishedAt.getTime() > now.getTime() && plan.finishedAt.getTime() < reset.getTime()) {
    return plan.finishedAt;
  }
  return reset;
}

/** Whole days until a moment, rounded up, so anything left today counts as one day. */
export function daysUntil(when: Date, now: Date): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / DAY_MS));
}

/** True when two moments are within a minute of each other. */
export function sameMoment(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < 60_000;
}
