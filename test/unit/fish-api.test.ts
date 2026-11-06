import assert from 'node:assert/strict';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  FishApiError,
  fetchBalances,
  InvalidApiKeyError,
  isWellFormedApiKey,
  parseApiCredit,
  parsePlan,
} from '../../src/core/fish-api';

type Route = { status: number; body?: unknown; headers?: Record<string, string> };

/** A stand-in for api.fish.audio that records what it was asked. */
describe('fetchBalances', () => {
  let server: http.Server;
  let base: string;
  let routes: Record<string, Route>;
  let seen: { path: string; authorization: string | undefined }[];

  before(async () => {
    server = http.createServer((req, res) => {
      seen.push({ path: req.url ?? '', authorization: req.headers.authorization });
      const route = routes[req.url ?? ''] ?? { status: 404, body: { status: 404, message: 'Not found' } };
      res.writeHead(route.status, { 'Content-Type': 'application/json', ...route.headers });
      res.end(route.body === undefined ? '' : JSON.stringify(route.body));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    seen = [];
    routes = {
      '/wallet/self/package': {
        status: 200,
        body: {
          user_id: 'u1',
          type: 'plus',
          total: 120000,
          balance: 100712,
          created_at: '2026-08-05T17:45:00Z',
          updated_at: '2026-11-03T19:14:40Z',
          finished_at: '2027-08-05T17:45:00Z',
        },
      },
      '/wallet/self/api-credit': {
        status: 200,
        body: { _id: 'c1', user_id: 'u1', credit: '12.50', cumulative_top_up: '20' },
      },
    };
  });

  const now = () => new Date('2026-11-03T20:00:00Z');

  it('reads both balances and sends the key as a bearer token', async () => {
    const balances = await fetchBalances('secret-key', fetch, base, now);
    assert.deepEqual(balances.plan, {
      type: 'plus',
      total: 120000,
      balance: 100712,
      finishedAt: new Date('2027-08-05T17:45:00Z'),
      anchorDay: undefined,
      updatedAt: new Date('2026-11-03T19:14:40Z'),
    });
    assert.deepEqual(balances.apiCredit, { credit: 12.5 });
    assert.deepEqual(balances.fetchedAt, now());
    assert.deepEqual(seen.map((s) => s.path).sort(), ['/wallet/self/api-credit', '/wallet/self/package']);
    assert.ok(seen.every((s) => s.authorization === 'Bearer secret-key'));
  });

  it('treats a missing plan as no plan, not as an error', async () => {
    delete routes['/wallet/self/package'];
    const balances = await fetchBalances('k', fetch, base, now);
    assert.equal(balances.plan, undefined);
    assert.deepEqual(balances.apiCredit, { credit: 12.5 });
  });

  it('reports a rejected key', async () => {
    routes['/wallet/self/package'] = { status: 401, body: { status: 401, message: 'No permission' } };
    routes['/wallet/self/api-credit'] = { status: 401, body: { status: 401, message: 'No permission' } };
    await assert.rejects(fetchBalances('bad', fetch, base, now), InvalidApiKeyError);
  });

  it('reports a rejected key even when only one request says so', async () => {
    routes['/wallet/self/api-credit'] = { status: 403 };
    await assert.rejects(fetchBalances('bad', fetch, base, now), InvalidApiKeyError);
  });

  it('keeps the plan when only the API credit request fails', async () => {
    routes['/wallet/self/api-credit'] = { status: 503, body: { status: 503, message: 'Busy' } };
    const balances = await fetchBalances('k', fetch, base, now);
    assert.equal(balances.plan?.balance, 100712);
    assert.equal(balances.apiCredit, undefined);
  });

  it('fails with the server message when both requests fail', async () => {
    routes['/wallet/self/package'] = { status: 503, body: { status: 503, message: 'High load' } };
    routes['/wallet/self/api-credit'] = { status: 503, body: { status: 503, message: 'High load' } };
    await assert.rejects(fetchBalances('k', fetch, base, now), (error: unknown) => {
      assert.ok(error instanceof FishApiError);
      assert.equal(error.status, 503);
      assert.match(error.message, /High load/);
      return true;
    });
  });

  it('does not follow a redirect, so the key cannot be sent elsewhere', async () => {
    routes['/wallet/self/package'] = { status: 302, headers: { Location: '/elsewhere' } };
    routes['/wallet/self/api-credit'] = { status: 302, headers: { Location: '/elsewhere' } };
    routes['/elsewhere'] = { status: 200, body: { credit: '1' } };
    await assert.rejects(fetchBalances('secret-key', fetch, base, now), TypeError);
    assert.ok(!seen.some((s) => s.path === '/elsewhere'));
  });

  it('fails when the server cannot be reached', async () => {
    await assert.rejects(fetchBalances('k', fetch, 'http://127.0.0.1:1', now), TypeError);
  });
});

describe('parsePlan', () => {
  it('accepts numbers sent as strings and ignores a bad date', () => {
    assert.deepEqual(parsePlan({ type: 'pro', total: '10', balance: '4', finished_at: 'soon' }), {
      type: 'pro',
      total: 10,
      balance: 4,
      finishedAt: undefined,
      anchorDay: undefined,
      updatedAt: undefined,
    });
  });

  it('reads the day the credits are refilled on, and drops impossible days', () => {
    assert.equal(parsePlan({ total: 1, balance: 1, anchor_day: 5 })?.anchorDay, 5);
    assert.equal(parsePlan({ total: 1, balance: 1, anchor_day: '31' })?.anchorDay, 31);
    assert.equal(parsePlan({ total: 1, balance: 1, anchor_day: 0 })?.anchorDay, undefined);
    assert.equal(parsePlan({ total: 1, balance: 1, anchor_day: 32 })?.anchorDay, undefined);
    assert.equal(parsePlan({ total: 1, balance: 1, anchor_day: null })?.anchorDay, undefined);
  });

  it('rejects bodies without amounts', () => {
    assert.equal(parsePlan(undefined), undefined);
    assert.equal(parsePlan({ type: 'pro' }), undefined);
    assert.equal(parsePlan({ total: 'many', balance: 1 }), undefined);
  });
});

describe('parseApiCredit', () => {
  it('reads the credit string', () => {
    assert.deepEqual(parseApiCredit({ credit: '0' }), { credit: 0 });
    assert.equal(parseApiCredit({ credit: 'n/a' }), undefined);
    assert.equal(parseApiCredit(null), undefined);
  });
});

describe('isWellFormedApiKey', () => {
  it('accepts a run of visible characters', () => {
    assert.equal(isWellFormedApiKey('0123456789abcdef0123456789abcdef'), true);
  });

  it('rejects spaces, line breaks, non-ASCII and very short or long values', () => {
    assert.equal(isWellFormedApiKey('abcd efgh ijkl'), false);
    assert.equal(isWellFormedApiKey('abcdefgh\r\nX-Other: 1'), false);
    assert.equal(isWellFormedApiKey('abcdefgh\u201d'), false);
    assert.equal(isWellFormedApiKey('short'), false);
    assert.equal(isWellFormedApiKey('a'.repeat(513)), false);
  });
});
