/** The Fish Audio REST API. Fixed on purpose: a configurable URL would let a workspace redirect the API key. */
export const FISH_API_BASE = 'https://api.fish.audio';

const TIMEOUT_MS = 15_000;

/** Credits included in the user's plan (GET /wallet/self/package). */
export interface PlanCredits {
  /** Plan name as reported by the API, for example "plus". */
  type: string;
  total: number;
  balance: number;
  /** When the plan's paid period ends (`finished_at`), if the API reports it. */
  finishedAt: Date | undefined;
  /** UTC day of the month the credits are refilled on (`anchor_day`, 1-31), if the API reports it. */
  anchorDay: number | undefined;
  /** When the package record last changed (`updated_at`); the API's fallback for a missing anchor day. */
  updatedAt: Date | undefined;
}

/** Pay-as-you-go API credit in US dollars (GET /wallet/self/api-credit). */
export interface ApiCredit {
  credit: number;
}

export interface Balances {
  /** Undefined when the account has no plan package. */
  plan: PlanCredits | undefined;
  /** Undefined when the API credit could not be read. */
  apiCredit: ApiCredit | undefined;
  fetchedAt: Date;
}

/** The key was rejected; the user has to enter a new one. */
export class InvalidApiKeyError extends Error {
  constructor() {
    super('Fish Audio rejected the API key.');
    this.name = 'InvalidApiKeyError';
  }
}

/** Fish Audio answered with an error status other than 401/403. */
export class FishApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Fish Audio returned HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'FishApiError';
  }
}

export type FetchFn = typeof fetch;

/**
 * A key is one run of visible ASCII characters. Anything else is a paste
 * mistake (a line break, a space, a smart quote), and a line break in a
 * header could also smuggle in a second header.
 */
export function isWellFormedApiKey(value: string): boolean {
  return /^[\x21-\x7e]{8,512}$/.test(value);
}

/**
 * Reads both balances. A missing plan package (404) is not an error; an
 * invalid key is, and so is any failure of both requests.
 */
export async function fetchBalances(
  apiKey: string,
  fetchFn: FetchFn = fetch,
  base: string = FISH_API_BASE,
  now: () => Date = () => new Date(),
): Promise<Balances> {
  const [plan, apiCredit] = await Promise.allSettled([
    getJson(`${base}/wallet/self/package`, apiKey, fetchFn),
    getJson(`${base}/wallet/self/api-credit`, apiKey, fetchFn),
  ]);

  // A rejected key makes both requests fail the same way; report that first.
  for (const result of [plan, apiCredit]) {
    if (result.status === 'rejected' && result.reason instanceof InvalidApiKeyError) {
      throw result.reason;
    }
  }
  if (plan.status === 'rejected' && apiCredit.status === 'rejected') {
    throw plan.reason;
  }

  return {
    plan: plan.status === 'fulfilled' ? parsePlan(plan.value) : undefined,
    apiCredit: apiCredit.status === 'fulfilled' ? parseApiCredit(apiCredit.value) : undefined,
    fetchedAt: now(),
  };
}

async function getJson(url: string, apiKey: string, fetchFn: FetchFn): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    // Never follow a redirect: the key must reach api.fish.audio and nothing else.
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403) {
    throw new InvalidApiKeyError();
  }
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new FishApiError(response.status, await errorDetail(response));
  }
  return response.json();
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message.slice(0, 200) : '';
  } catch {
    return '';
  }
}

export function parsePlan(value: unknown): PlanCredits | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const total = toNumber(value.total);
  const balance = toNumber(value.balance);
  if (total === undefined || balance === undefined) {
    return undefined;
  }
  const anchorDay = toNumber(value.anchor_day);
  return {
    type: typeof value.type === 'string' ? value.type : '',
    total,
    balance,
    finishedAt: toDate(value.finished_at),
    anchorDay:
      anchorDay !== undefined && Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31
        ? anchorDay
        : undefined,
    updatedAt: toDate(value.updated_at),
  };
}

function toDate(value: unknown): Date | undefined {
  const date = typeof value === 'string' ? new Date(value) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

export function parseApiCredit(value: unknown): ApiCredit | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const credit = toNumber(value.credit);
  return credit === undefined ? undefined : { credit };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The API sends some amounts as strings ("credit": "12.50"). */
function toNumber(value: unknown): number | undefined {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}
