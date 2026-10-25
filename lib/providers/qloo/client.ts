import type { RankedAnchor } from "@/lib/domain/utility";
import { QLOO_DEFAULTS, type QlooConfig } from "./config";
import { QlooError } from "./errors";
import { parseInsights, parseSearch, type ParsedInsightEntity, type SearchCandidate } from "./parse";
import { buildInsightsParams, buildPlaceInsightsParams, buildSearchParams, queryFingerprint } from "./request";

/**
 * Shared per-job allowance: at most `maxCalls` HTTP attempts (including retries)
 * before the job deadline. One budget is created per match run.
 */
export class CallBudget {
  private used = 0;

  constructor(
    readonly maxCalls: number = QLOO_DEFAULTS.callsPerJob,
    readonly deadlineAt: number = Number.POSITIVE_INFINITY,
    private readonly now: () => number = Date.now,
  ) {}

  get callsUsed(): number {
    return this.used;
  }

  remainingMs(): number {
    return this.deadlineAt - this.now();
  }

  consume(): void {
    if (this.remainingMs() <= 0) {
      throw new QlooError("JOB_DEADLINE_EXCEEDED", "DEADLINE_EXCEEDED", true);
    }
    if (this.used >= this.maxCalls) {
      throw new QlooError("QLOO_UNAVAILABLE", "CALL_BUDGET_EXHAUSTED", true);
    }
    this.used++;
  }
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((r) => this.waiting.push(r));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

export interface ProviderMeta {
  source_mode: "live";
  fetched_at: string;
  query_fingerprint: string;
}

export interface QlooClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxConcurrency?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function retryAfterMs(header: string | null): number {
  if (!header) return 1_000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? 1_000 : Math.max(0, date - Date.now());
}

function classifyStatus(status: number, retryAfter: string | null): QlooError {
  if (status === 401) return new QlooError("QLOO_UNAVAILABLE", "AUTH_REJECTED", false, status);
  if (status === 403) return new QlooError("QLOO_UNAVAILABLE", "ENTITY_TYPE_FORBIDDEN", false, status);
  if (status === 429) return new QlooError("RATE_LIMITED", "RATE_LIMITED", true, status, retryAfterMs(retryAfter));
  if (status >= 500) return new QlooError("QLOO_UNAVAILABLE", "SERVER_ERROR", true, status);
  return new QlooError("QLOO_UNAVAILABLE", "BAD_REQUEST", false, status);
}

/** Server-only Qloo adapter. Never import from client components. */
export class QlooClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly semaphore: Semaphore;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly config: QlooConfig,
    options: QlooClientOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? QLOO_DEFAULTS.requestTimeoutMs;
    this.semaphore = new Semaphore(options.maxConcurrency ?? QLOO_DEFAULTS.maxConcurrency);
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** GET /search for organiser disambiguation. Never guesses an ID. */
  async search(
    query: string,
    budget: CallBudget,
    options: { take?: number; types?: readonly string[] } = {},
  ): Promise<{ candidates: SearchCandidate[]; meta: ProviderMeta }> {
    const params = buildSearchParams(query, options.take, options.types);
    const { body, meta } = await this.get("/search", params, budget);
    return { candidates: parseSearch(body), meta };
  }

  /** GET /v2/insights ranking the fixed anchor universe for one group's confirmed IDs. */
  async rankAnchors(
    confirmedEntityIds: readonly string[],
    anchorEntityIds: readonly string[],
    budget: CallBudget,
  ): Promise<{ entities: ParsedInsightEntity[]; ranked: RankedAnchor[]; meta: ProviderMeta }> {
    const params = buildInsightsParams(confirmedEntityIds, anchorEntityIds);
    const { body, meta } = await this.get("/v2/insights", params, budget);
    const entities = parseInsights(body);
    return {
      entities,
      ranked: entities.map((e) => ({ entity_id: e.entity_id, raw_score: e.raw_score })),
      meta,
    };
  }

  async rankPlaces(interests: readonly string[], venueIds: readonly string[], budget: CallBudget) {
    const { body, meta } = await this.get("/v2/insights", buildPlaceInsightsParams(interests, venueIds), budget);
    return { entities: parseInsights(body), meta };
  }

  private async get(
    path: "/search" | "/v2/insights",
    params: URLSearchParams,
    budget: CallBudget,
  ): Promise<{ body: unknown; meta: ProviderMeta }> {
    const url = `${this.config.baseUrl}${path}?${params.toString()}`;
    const fingerprint = queryFingerprint(path, params, this.config.baseUrl);

    for (let attempt = 0; ; attempt++) {
      const outcome = await this.semaphore.run(() => this.attempt(url, budget));
      if (!(outcome instanceof QlooError)) {
        return {
          body: outcome.body,
          meta: {
            source_mode: "live",
            fetched_at: new Date(this.now()).toISOString(),
            query_fingerprint: fingerprint,
          },
        };
      }
      if (!outcome.retryable || attempt >= QLOO_DEFAULTS.maxRetriesPerRequest) throw outcome;
      const wait = outcome.retryAfterMs ?? 250;
      if (wait >= budget.remainingMs()) {
        throw new QlooError("JOB_DEADLINE_EXCEEDED", "DEADLINE_EXCEEDED", true, outcome.status);
      }
      await this.sleep(wait);
    }
  }

  private async attempt(url: string, budget: CallBudget): Promise<{ body: unknown } | QlooError> {
    budget.consume();
    const controller = new AbortController();
    const timeout = Math.min(this.timeoutMs, Math.max(0, budget.remainingMs()));
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { "X-Api-Key": this.config.apiKey, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) return classifyStatus(response.status, response.headers.get("retry-after"));
      try {
        return { body: await response.json() };
      } catch {
        return new QlooError("PROVIDER_SCHEMA_CHANGED", "MALFORMED_RESPONSE", false, response.status);
      }
    } catch {
      return controller.signal.aborted
        ? new QlooError("QLOO_UNAVAILABLE", "TIMEOUT", true)
        : new QlooError("QLOO_UNAVAILABLE", "NETWORK", true);
    } finally {
      clearTimeout(timer);
    }
  }
}
