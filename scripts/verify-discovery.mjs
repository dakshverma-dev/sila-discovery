// Local HTTP + PostgreSQL verification. Calls real Qloo for evidence; never a browser driver.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Pool } from "pg";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = process.env.DISCOVERY_TEST_URL || "http://localhost:3500";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Verification only runs on loopback");
const config = JSON.parse(
  readFileSync(resolve(root, ".discovery-local.json"), "utf8"),
);
const admin = new Pool({
  connectionString: `postgresql://postgres:${config.admin}@127.0.0.1:57432/sila_discovery`,
});
const limited = new Pool({
  connectionString: `postgresql://sila_discovery:${config.app}@127.0.0.1:57432/sila_discovery`,
});
let assertions = 0;
function check(condition, message) {
  assert(condition, message);
  assertions++;
  console.log(`PASS ${message}`);
}
function browser() {
  let cookie = "";
  return async function http(path, payload, options = {}) {
    const response = await fetch(`${base}${path}`, {
      method: payload === undefined ? "GET" : "POST",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        Origin: base,
        ...(payload === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await response.json();
    return { status: response.status, data };
  };
}
const alice = browser(),
  bob = browser();
const constraints = {
  clubName: "Verification Fictional Club",
  city: "Edinburgh",
  startDate: "2026-11-19",
  endDate: "2026-11-22",
  places: 7,
  maxPricePence: 3500,
  useAssistant: false,
};
async function discover(http, query, type, overrides = {}) {
  const search = await http(`/api/interests?q=${encodeURIComponent(query)}`);
  check(
    search.status === 200 && search.data.sourceMode === "live",
    `${query}: live interest search`,
  );
  const interest = search.data.candidates.find(
    (c) => c.name === query && c.type === `urn:entity:${type}`,
  );
  assert(interest, `Expected a disambiguated ${query} ${type}`);
  const payload = {
    ...constraints,
    interestEntityIds: [interest.entityId],
    interestProofs: [interest.proof],
    ...overrides,
  };
  const run = await http("/api/discover", payload);
  check(
    run.status === 200 && run.data.sourceMode === "live",
    `${query}: real Qloo discovery`,
  );
  return { run: run.data, payload };
}
const traces = [];
let original;
try {
  const film = await discover(alice, "Spirited Away", "movie");
  const jazz = await discover(alice, "Miles Davis", "artist");
  check(
    film.run.returnedVenueIds.join() !== jazz.run.returnedVenueIds.join(),
    "Two real taste profiles produce different venue orders",
  );
  for (const [label, value] of [
    ["film", film],
    ["jazz", jazz],
  ]) {
    check(
      value.run.recommendations.length > 0 &&
        value.run.recommendations.every(
          (s) => s.pricePence <= 3500 && s.remaining >= 7,
        ),
      `${label}: every result meets budget and capacity`,
    );
    check(
      value.run.exclusions.some((e) => e.sessionId === "print-room") &&
        value.run.exclusions.some((e) => e.sessionId === "photography"),
      `${label}: unsuitable sessions excluded`,
    );
    traces.push({
      profile: label,
      selectedInterests: value.run.interests,
      sourceMode: value.run.sourceMode,
      provider: value.run.provider,
      returnedVenueIds: value.run.returnedVenueIds,
      recommendations: value.run.recommendations.map(
        ({ id, venueId, providerRank, pricePence, remaining }) => ({
          id,
          venueId,
          providerRank,
          pricePence,
          remaining,
        }),
      ),
      exclusions: value.run.exclusions,
      callsUsed: value.run.callsUsed,
      assistant: value.run.assistant,
    });
  }
  const cheap = await alice("/api/discover", {
    ...film.payload,
    maxPricePence: 1000,
  });
  check(
    cheap.status === 200 && cheap.data.recommendations.length === 0,
    "£10 budget returns an honest empty result",
  );
  const forged = await bob("/api/discover", film.payload);
  check(
    forged.status === 422,
    "Another visitor cannot replay signed interest selections",
  );
  const bad = await browser()("/api/discover", { ...film.payload, places: 13 });
  check(bad.status === 422, "Oversized party rejected server-side");
  const crossOrigin = await alice(
    "/api/place-requests",
    {},
    { headers: { Origin: "https://another.example" } },
  );
  check(crossOrigin.status === 403, "Cross-origin writes rejected");
  const recommended = film.run.recommendations[0];
  const command = {
    runId: film.run.runId,
    sessionId: recommended.id,
    places: 7,
    expectedPricePence: recommended.pricePence,
    expectedVersion: recommended.version,
    requestKey: randomUUID(),
  };
  const stalePrice = await alice("/api/place-requests", {
    ...command,
    expectedPricePence: recommended.pricePence + 100,
  });
  check(stalePrice.status === 409, "Stale price rejected before saving");
  const requests = await Promise.all(
    Array.from({ length: 6 }, () => alice("/api/place-requests", command)),
  );
  check(
    requests.every(
      (r) => r.status === 201 && r.data.id === requests[0].data.id,
    ),
    "Six concurrent retries create exactly one request",
  );
  const requestId = requests[0].data.id;
  const own = await alice(`/api/place-requests/${requestId}`);
  check(
    own.status === 200 &&
      own.data.totalPence === recommended.pricePence * 7 &&
      own.data.status === "conditional",
    "Owner can retrieve persisted exact-price conditional request",
  );
  const other = await bob(`/api/place-requests/${requestId}`);
  check(
    other.status === 404,
    "Other visitor receives a neutral 404 for the request",
  );
  const reuse = await alice("/api/place-requests", { ...command, places: 6 });
  check(
    reuse.status === 409,
    "Same idempotency key with different details is rejected",
  );
  const db = await admin.query(
    "select snapshot from discovery.sessions where id=$1",
    [recommended.id],
  );
  original = db.rows[0].snapshot;
  await admin.query("update discovery.sessions set snapshot=$2 where id=$1", [
    recommended.id,
    JSON.stringify({
      ...original,
      remaining: 1,
      version: original.version + 1,
    }),
  ]);
  const staleCapacity = await alice("/api/place-requests", {
    ...command,
    requestKey: randomUUID(),
  });
  check(
    staleCapacity.status === 409,
    "Changed capacity/version is rechecked and rejected",
  );
  await admin.query("update discovery.sessions set snapshot=$2 where id=$1", [
    original.id,
    JSON.stringify(original),
  ]);
  original = undefined;
  const after = await admin.query(
    "select snapshot from discovery.sessions where id=$1",
    [recommended.id],
  );
  check(
    after.rows[0].snapshot.remaining === recommended.remaining,
    "Conditional request reserves no real or sample capacity",
  );
  const invisible = await limited.query("select id from discovery.requests");
  check(invisible.rowCount === 0, "Database RLS denies unscoped request reads");
  try {
    await limited.query(
      "update discovery.sessions set snapshot=snapshot where false",
    );
    throw new Error("Unexpected write grant");
  } catch (error) {
    check(
      error.code === "42501",
      "Application database role cannot change sessions",
    );
  }
  const count = await admin.query(
    "select count(*)::int as count from discovery.requests where id=$1",
    [requestId],
  );
  check(
    count.rows[0].count === 1,
    "Database contains one durable row for concurrent retries",
  );
  const deniedBudget = await limited.query(
    "select discovery.reserve_provider_calls(1) as allowed",
  );
  check(deniedBudget.rows[0].allowed === false, "Shared provider quota rejects exhausted allowance");
  const foreignRun = await bob("/api/place-requests", { ...command, requestKey: randomUUID() });
  check(foreignRun.status === 404, "Another visitor cannot create a request from a private run");
  const output = resolve(root, "docs/submission/evidence");
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, "live-traces.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        endpoint: "/v2/insights",
        scope: "Five verified venues; all sessions fictional",
        traces,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    resolve(output, "verification.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: "local HTTP, real Qloo, dedicated PostgreSQL",
        assertions,
        result: "passed",
        mockedAssistant: false,
        anthropicLiveVerified: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Verified ${assertions} assertions. Redacted evidence saved; no credentials or visitor cookies exported.`,
  );
} finally {
  if (original)
    await admin.query("update discovery.sessions set snapshot=$2 where id=$1", [
      original.id,
      JSON.stringify(original),
    ]);
  await Promise.all([admin.end(), limited.end()]);
}
