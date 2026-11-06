import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Balances } from '../../src/core/fish-api';
import type { PlanCredits } from '../../src/core/fish-api';
import {
  clampInterval,
  daysUntil,
  formatCredits,
  formatUsd,
  headline,
  isStale,
  nextCreditReset,
} from '../../src/core/presentation';

const at = new Date('2026-11-03T20:00:00Z');
const withPlan = (balance: number, total = 1000): Balances => ({
  plan: { type: 'plus', total, balance, finishedAt: undefined, anchorDay: undefined, updatedAt: undefined },
  apiCredit: { credit: 5 },
  fetchedAt: at,
});

describe('headline', () => {
  it('leads with the plan balance', () => {
    assert.deepEqual(headline(withPlan(500), 10, 'en'), { text: '500', severity: 'normal', remainingPercent: 50 });
  });

  it('warns below the threshold, and at zero even with the threshold off', () => {
    assert.equal(headline(withPlan(99), 10, 'en').severity, 'warning');
    assert.equal(headline(withPlan(100), 10, 'en').severity, 'normal');
    assert.equal(headline(withPlan(0), 0, 'en').severity, 'warning');
  });

  it('shows the API credit when there is no plan', () => {
    const balances: Balances = { plan: undefined, apiCredit: { credit: 12.5 }, fetchedAt: at };
    assert.equal(headline(balances, 10, 'en').text, '$12.50');
    assert.equal(headline({ ...balances, apiCredit: { credit: 0 } }, 10, 'en').severity, 'warning');
  });

  it('copes with a plan whose total is zero', () => {
    assert.equal(headline(withPlan(0, 0), 10, 'en').remainingPercent, undefined);
  });
});

describe('formatting', () => {
  it('groups digits for the display language', () => {
    assert.equal(formatCredits(100712, 'en'), '100,712');
    assert.equal(formatCredits(100712, 'de'), '100.712');
    assert.equal(formatUsd(12.5, 'en'), '$12.50');
  });
});

describe('isStale', () => {
  it('is stale with no data or after the interval', () => {
    assert.equal(isStale(undefined, 30, at), true);
    assert.equal(isStale(new Date(at.getTime() - 29 * 60_000), 30, at), false);
    assert.equal(isStale(new Date(at.getTime() - 30 * 60_000), 30, at), true);
  });
});

describe('clampInterval', () => {
  it('keeps the interval within 5 minutes and a day', () => {
    assert.equal(clampInterval(1), 5);
    assert.equal(clampInterval(60), 60);
    assert.equal(clampInterval(10_000), 1440);
    assert.equal(clampInterval(Number.NaN), 30);
  });
});

describe('nextCreditReset', () => {
  const plan = (fields: Partial<PlanCredits>): PlanCredits => ({
    type: 'plus',
    total: 250000,
    balance: 250000,
    finishedAt: undefined,
    anchorDay: undefined,
    updatedAt: undefined,
    ...fields,
  });
  const annual = plan({ finishedAt: new Date('2027-08-05T17:45:00Z') });

  it('uses the day and time the plan ends, in the coming month', () => {
    assert.deepEqual(nextCreditReset(annual, new Date('2026-11-06T12:00:00Z')), new Date('2026-12-05T17:45:00Z'));
  });

  it('uses this month while the day has not come yet', () => {
    assert.deepEqual(nextCreditReset(annual, new Date('2026-11-05T17:44:00Z')), new Date('2026-11-05T17:45:00Z'));
    assert.deepEqual(nextCreditReset(annual, new Date('2026-11-05T17:45:00Z')), new Date('2026-12-05T17:45:00Z'));
  });

  it('prefers the anchor day the API reports', () => {
    const anchored = plan({ ...annual, anchorDay: 20 });
    assert.deepEqual(nextCreditReset(anchored, new Date('2026-11-06T12:00:00Z')), new Date('2026-11-20T17:45:00Z'));
  });

  it('moves the 31st to the last day of shorter months', () => {
    const late = plan({ anchorDay: 31 });
    assert.deepEqual(nextCreditReset(late, new Date('2027-02-10T00:00:00Z')), new Date('2027-02-28T00:00:00Z'));
    assert.deepEqual(nextCreditReset(late, new Date('2026-12-31T12:00:00Z')), new Date('2027-01-31T00:00:00Z'));
  });

  it('falls back to the day the package was last updated', () => {
    const updated = plan({ updatedAt: new Date('2026-10-12T08:00:00Z') });
    assert.deepEqual(nextCreditReset(updated, new Date('2026-11-06T12:00:00Z')), new Date('2026-11-12T00:00:00Z'));
  });

  it('stops at the end of a plan that ends before the next refill', () => {
    const ending = plan({ anchorDay: 20, finishedAt: new Date('2026-11-10T09:00:00Z') });
    assert.deepEqual(nextCreditReset(ending, new Date('2026-11-06T12:00:00Z')), new Date('2026-11-10T09:00:00Z'));
  });

  it('is unknown when nothing says which day', () => {
    assert.equal(nextCreditReset(plan({}), new Date('2026-11-06T12:00:00Z')), undefined);
  });
});

describe('daysUntil', () => {
  it('rounds up, and never goes below zero', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    assert.equal(daysUntil(new Date('2026-12-05T17:45:00Z'), now), 30);
    assert.equal(daysUntil(new Date('2026-11-06T13:00:00Z'), now), 1);
    assert.equal(daysUntil(new Date('2026-11-05T13:00:00Z'), now), 0);
  });
});
