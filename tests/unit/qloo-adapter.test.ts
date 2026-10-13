import { describe, expect, it, vi } from "vitest";
import { CallBudget, QlooClient } from "@/lib/providers/qloo/client";
import { QLOO_HACKATHON_BASE_URL, qlooConfigFromEnv } from "@/lib/providers/qloo/config";
import { QlooError } from "@/lib/providers/qloo/errors";
import { parseInsights, parseSearch } from "@/lib/providers/qloo/parse";
import { buildInsightsParams, queryFingerprint } from "@/lib/providers/qloo/request";

// Synthetic, hand-written response shapes. Not captured provider payloads.
const API_KEY = "test-key-not-real";
const config = { baseUrl: QLOO_HACKATHON_BASE_URL, apiKey: API_KEY };
const anchors = ["ANCHOR_A", "ANCHOR_B", "ANCHOR_C"];
const insightsBody = {
  success: true,
  results: {
    entities: [
      { entity_id: "ANCHOR_B", name: "Synthetic B", subtype: "urn:entity:book", query: { affinity: 0.9 } },
      { entity_id: "ANCHOR_A", name: "Synthetic A", subtype: "urn:entity:book", query: { affinity: 0.7 } },
      { entity_id: "ANCHOR_C", name: "Synthetic C", subtype: "urn:entity:book" },
    ],
  },
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientWith(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected call");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = new QlooClient(config, { fetch: fetchMock as typeof fetch, sleep });
  return { client, calls, sleep };
}

async function failure(p: Promise<unknown>): Promise<QlooError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof QlooError) return e;
    throw e;
  }
  throw new Error("expected a QlooError");
}

describe("Qloo configuration", () => {
  it("defaults to the hackathon host and requires a key", () => {
    expect(qlooConfigFromEnv({ QLOO_API_KEY: "k" }).baseUrl).toBe(QLOO_HACKATHON_BASE_URL);
    expect(() => qlooConfigFromEnv({})).toThrow(QlooError);
  });

  it.each(["https://api.qloo.com", "https://staging.api.qloo.com", "http://hackathon.api.qloo.com"])(
    "refuses the non-hackathon host %s",
    (host) => {
      expect(() => qlooConfigFromEnv({ QLOO_API_KEY: "k", QLOO_BASE_URL: host })).toThrow(QlooError);
    },
  );
});

describe("Insights request construction (D11)", () => {
  it("builds the fixed-universe book query", () => {
    const p = buildInsightsParams(["SIG_1", "SIG_2"], anchors);
    expect(Object.fromEntries(p)).toEqual({
      "filter.type": "urn:entity:book",
      "signal.interests.entities": "SIG_1,SIG_2",
      "filter.results.entities": "ANCHOR_A,ANCHOR_B,ANCHOR_C",
      take: "3",
      "feature.explainability": "true",
    });
  });

  it.each([
    ["no confirmed entity", [], anchors],
    ["a one-anchor universe", ["SIG_1"], ["ANCHOR_A"]],
    ["duplicate anchors", ["SIG_1"], ["ANCHOR_A", "ANCHOR_A"]],
    ["an ID that could inject parameters", ["SIG_1,x&take=99"], anchors],
    ["more than 30 anchors", ["SIG_1"], Array.from({ length: 31 }, (_, i) => `A${i}`)],
  ])("rejects %s", (_, signals, universe) => {
    expect(() => buildInsightsParams(signals, universe)).toThrow(QlooError);
  });

  it("fingerprints equivalent queries identically regardless of parameter order", () => {
    const a = new URLSearchParams({ x: "1", y: "2" });
    const b = new URLSearchParams({ y: "2", x: "1" });
    expect(queryFingerprint("/v2/insights", a)).toBe(queryFingerprint("/v2/insights", b));
  });
});

describe("Qloo client transport", () => {
  it("sends a GET with the key only in the X-Api-Key header", async () => {
    const { client, calls } = clientWith([json(insightsBody)]);
    const r = await client.rankAnchors(["SIG_1"], anchors, new CallBudget());
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url.startsWith(`${QLOO_HACKATHON_BASE_URL}/v2/insights?`)).toBe(true);
    expect(url).not.toContain(API_KEY);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Api-Key"]).toBe(API_KEY);
    expect(headers.Authorization).toBeUndefined();
    expect(r.ranked.map((x) => x.entity_id)).toEqual(["ANCHOR_B", "ANCHOR_A", "ANCHOR_C"]);
    expect(r.entities[0]).toMatchObject({ rank: 1, raw_score: 0.9 });
    expect(r.meta.source_mode).toBe("live");
  });

  it("uses the separate /search contract for entity lookup", async () => {
    const { client, calls } = clientWith([
      json({ results: [{ entity_id: "E1", name: "Synthetic title", types: ["urn:entity:book"] }] }),
    ]);
    const r = await client.search("synthetic title", new CallBudget());
    expect(calls[0]!.url).toContain(`${QLOO_HACKATHON_BASE_URL}/search?query=synthetic+title`);
    expect(r.candidates).toEqual([
      { entity_id: "E1", name: "Synthetic title", subtype: undefined, types: ["urn:entity:book"] },
    ]);
  });

  it.each([
    [401, "AUTH_REJECTED"],
    [403, "ENTITY_TYPE_FORBIDDEN"],
    [400, "BAD_REQUEST"],
  ])("does not retry HTTP %i", async (status, reason) => {
    const { client, calls } = clientWith([json({}, status), json(insightsBody)]);
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, new CallBudget()));
    expect(err).toMatchObject({ reason, retryable: false, status });
    expect(calls).toHaveLength(1);
    expect(err.message).not.toContain(API_KEY);
  });

  it("retries a 429 once, honouring Retry-After", async () => {
    const { client, calls, sleep } = clientWith([
      json({}, 429, { "retry-after": "2" }),
      json(insightsBody),
    ]);
    const budget = new CallBudget();
    await client.rankAnchors(["SIG_1"], anchors, budget);
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(budget.callsUsed).toBe(2);
  });

  it("fails visibly after a second transient failure", async () => {
    const { client, calls } = clientWith([json({}, 503), json({}, 502)]);
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, new CallBudget()));
    expect(err).toMatchObject({ code: "QLOO_UNAVAILABLE", reason: "SERVER_ERROR" });
    expect(calls).toHaveLength(2);
  });

  it("ends the job when Retry-After exceeds the remaining deadline", async () => {
    const { client } = clientWith([json({}, 429, { "retry-after": "60" })]);
    const budget = new CallBudget(24, 10_000, () => 0);
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, budget));
    expect(err.code).toBe("JOB_DEADLINE_EXCEEDED");
  });

  it("counts retries against the shared job budget", async () => {
    const { client, calls } = clientWith([json({}, 500)]);
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, new CallBudget(1)));
    expect(err.reason).toBe("CALL_BUDGET_EXHAUSTED");
    expect(calls).toHaveLength(1);
  });

  it("classifies a network error as retryable unavailability", async () => {
    const { client, calls } = clientWith([new TypeError("fetch failed"), json(insightsBody)]);
    const r = await client.rankAnchors(["SIG_1"], anchors, new CallBudget());
    expect(calls).toHaveLength(2);
    expect(r.ranked).toHaveLength(3);
  });

  it("times out a hung request", async () => {
    const hanging = vi.fn(
      (_: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const client = new QlooClient(config, {
      fetch: hanging as unknown as typeof fetch,
      timeoutMs: 5,
      sleep: async () => {},
    });
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, new CallBudget()));
    expect(err).toMatchObject({ code: "QLOO_UNAVAILABLE", reason: "TIMEOUT" });
    expect(hanging).toHaveBeenCalledTimes(2);
  });

  it("limits concurrent provider calls", async () => {
    let active = 0;
    let peak = 0;
    const slow = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return json(insightsBody);
    });
    const client = new QlooClient(config, { fetch: slow as unknown as typeof fetch, maxConcurrency: 4 });
    const budget = new CallBudget();
    await Promise.all(Array.from({ length: 10 }, () => client.rankAnchors(["SIG_1"], anchors, budget)));
    expect(peak).toBeLessThanOrEqual(4);
    expect(budget.callsUsed).toBe(10);
  });
});

describe("Qloo response parsing", () => {
  it("accepts an empty 200 as valid data (unknown coverage, not dislike)", () => {
    expect(parseInsights({ results: { entities: [] } })).toEqual([]);
  });

  it.each([
    ["a missing results envelope", { success: true }],
    ["entities that are not an array", { results: { entities: {} } }],
    ["an entity without an ID", { results: { entities: [{ name: "x" }] } }],
    ["a non-object body", "<html>"],
  ])("flags %s as PROVIDER_SCHEMA_CHANGED", (_, body) => {
    expect(() => parseInsights(body)).toThrow(
      expect.objectContaining({ code: "PROVIDER_SCHEMA_CHANGED" }),
    );
  });

  it("flags a malformed search envelope", () => {
    expect(() => parseSearch({ results: "nope" })).toThrow(
      expect.objectContaining({ code: "PROVIDER_SCHEMA_CHANGED" }),
    );
  });

  it("reports invalid JSON from the provider as a schema change", async () => {
    const { client } = clientWith([new Response("not json", { status: 200 })]);
    const err = await failure(client.rankAnchors(["SIG_1"], anchors, new CallBudget()));
    expect(err.code).toBe("PROVIDER_SCHEMA_CHANGED");
  });
});
