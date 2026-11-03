/** The Fish Audio REST API. Fixed on purpose: a configurable URL would let a workspace redirect the API key. */
export const FISH_API_BASE = 'https://api.fish.audio';

const TIMEOUT_MS = 15_000;

/** Credits included in the user's plan (GET /wallet/self/package). */
export interface PlanCredits {
  /** Plan name as reported by the API, for example "plus". */
  type: string;
  total: number;
  balance: number;
  /** When the current credit period ends, if the API reports it. */
  finishedAt: Date | undefined;
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
  const finishedAt = typeof value.finished_at === 'string' ? new Date(value.finished_at) : undefined;
  return {
    type: typeof value.type === 'string' ? value.type : '',
    total,
    balance,
    finishedAt: finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : undefined,
  };
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
