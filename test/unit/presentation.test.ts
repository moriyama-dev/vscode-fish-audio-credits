import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Balances } from '../../src/core/fish-api';
import { clampInterval, formatCredits, formatUsd, headline, isStale } from '../../src/core/presentation';

const at = new Date('2026-11-03T20:00:00Z');
const withPlan = (balance: number, total = 1000): Balances => ({
  plan: { type: 'plus', total, balance, finishedAt: undefined },
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
