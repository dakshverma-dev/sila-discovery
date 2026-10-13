import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processMatchRun, type RunResult } from "@/lib/agent/run";
import { ANCHOR_UNIVERSE } from "@/lib/demo/catalogue";
import { QlooClient } from "@/lib/providers/qloo/client";
import { QLOO_HACKATHON_BASE_URL } from "@/lib/providers/qloo/config";
import { json } from "@/lib/db/api";
import { admin, api, app, code, createDemo, ok, type Demo } from "./helpers";

let demo: Demo;

beforeAll(async () => {
  demo = await createDemo();
});

afterAll(async () => {
  await admin.query("update scb.workspaces set expires_at = now() - interval '1 second' where id = $1",
                    [demo.workspace_id]);
  await admin.query("select scb_api.purge_expired_demos()");
  await Promise.all([admin.end(), app.end()]);
});

interface RunView {
  state: string;
  error_code: string | null;
  result: RunResult | null;
}

async function runFor(organiserKey: string, groupKey: string, mode: "synthetic" | "live", qloo?: QlooClient) {
  const queued = await ok<{ run_id: string }>(
    api("create_match_run", demo.users[organiserKey], demo.groups[groupKey], mode, randomUUID()));
  const outcome = await processMatchRun(queued.run_id, { pool: app, qloo });
  const view = await ok<RunView>(api("get_match_run", demo.users[organiserKey], queued.run_id));
  return { runId: queued.run_id, outcome, view };
}

/** Hand-written synthetic Insights envelope; not a captured Qloo response. */
function fakeQloo(order: string[], status = 200): QlooClient {
  const fetchImpl = async () =>
    new Response(
      status === 200
        ? JSON.stringify({ results: { entities: order.map((id) => ({ entity_id: id, name: id })) } })
        : "{}",
      { status, headers: { "content-type": "application/json" } },
    );
  return new QlooClient({ baseUrl: QLOO_HACKATHON_BASE_URL, apiKey: "test-key" },
                        { fetch: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
}

async function addResolvedReferences(groupKey: string, organiserKey: string) {
  const { rows } = await admin.query(
    "select * from scb.group_briefs where group_id = $1 order by version desc limit 1", [demo.groups[groupKey]]);
  const b = rows[0];
  await ok(api("save_group_brief", demo.users[organiserKey], demo.groups[groupKey], b.budget_pence, b.expected_seats,
    json(b.availability), b.sharing_choice, true, b.access_requirements,
    json([{ input_label: "A synthetic reference", entity_id: `SYNTHETIC_REF_${groupKey}`, subtype: "urn:entity:book",
       declared_meaning: "Why it matters", resolved: true }]), randomUUID()));
}

describe("synthetic match run (R07, R14)", () => {
  it("saves up to three labelled drafts that all include the requesting group", async () => {
    const { outcome, view } = await runFor("org_book", "book_club", "synthetic");
    expect(outcome).toBe("SUCCEEDED");
    expect(view.state).toBe("SUCCEEDED");
    const result = view.result!;
    expect(result.outcome).toBe("CANDIDATES");
    expect(result.source_mode).toBe("synthetic");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    for (const c of result.candidates) expect(c.group_names).toContain("Illustrative book club");

    const { rows } = await admin.query(
      "select state, source_mode, run_id from scb.proposals where id = any($1)",
      [result.candidates.map((c) => c.proposal_id)]);
    expect(rows.every((r) => r.state === "DRAFT" && r.source_mode === "synthetic")).toBe(true);
    const evidence = await admin.query("select count(*)::int as n, min(source_mode) as m from scb.evidence_records where run_id = $1",
                                       [rows[0].run_id]);
    expect(evidence.rows[0]).toMatchObject({ m: "synthetic" });
    expect(evidence.rows[0].n).toBeGreaterThan(0);
  });

  it("shows each organiser only their own group's fit details", async () => {
    const { view } = await runFor("org_film", "film_society", "synthetic");
    const proposalId = view.result!.candidates[0]!.proposal_id;
    const asFilm = await ok<{ rationale: { by_group: Record<string, unknown>; reasons: unknown[] } }>(
      api("get_proposal_detail", demo.users.org_film, proposalId));
    expect(Object.keys(asFilm.rationale.by_group)).toEqual([demo.groups.film_society]);
    expect(asFilm.rationale.reasons.length).toBeGreaterThan(1);
    const asVenue = await ok<{ rationale: { by_group: Record<string, unknown> } }>(
      api("get_proposal_detail", demo.users.venue_manager, proposalId));
    expect(Object.keys(asVenue.rationale.by_group).length).toBeGreaterThan(1);
  });

  it("explains blockers without revealing other groups' private constraints", async () => {
    // The history walkers prefer private sessions, so no shared run is possible for them.
    const r = await api("create_match_run", demo.users.org_walk, demo.groups.walking_group, "synthetic", randomUUID());
    expect(r.ok ? "OK" : r.error.code).toBe("NEEDS_INPUT");
    expect(!r.ok && r.error.details).toMatchObject({ fields: ["sharing_choice"] });
  });

  it("lets an organiser send one draft for venue review", async () => {
    const { view } = await runFor("org_makers", "makers_group", "synthetic");
    const proposalId = view.result!.candidates[0]!.proposal_id;
    expect(await code(api("request_venue_review", demo.users.venue_manager, proposalId, randomUUID())))
      .toBe("FORBIDDEN");
    expect(await code(api("request_venue_review", demo.users.org_makers, proposalId, randomUUID()))).toBe("OK");
    const detail = await ok<{ review_requested_at: string | null }>(
      api("get_proposal_detail", demo.users.venue_manager, proposalId));
    expect(detail.review_requested_at).not.toBeNull();
  });

  it("rejects runs from someone who does not organise the group", async () => {
    expect(await code(api("create_match_run", demo.users.org_book, demo.groups.film_society, "synthetic", randomUUID())))
      .toBe("NOT_FOUND");
  });
});

describe("live-mode match run with a mocked provider (R05, BR16)", () => {
  it("requires resolved, consented references before a live run", async () => {
    const r = await api("create_match_run", demo.users.org_book, demo.groups.book_club, "live", randomUUID());
    expect(!r.ok && r.error.code).toBe("NEEDS_INPUT");
    expect(!r.ok && (r.error.details as { fields: string[] }).fields).toContain("references");
  });

  it("labels provider rankings live and records evidence", async () => {
    for (const [g, o] of [["book_club", "org_book"], ["film_society", "org_film"], ["makers_group", "org_makers"]]) {
      await addResolvedReferences(g!, o!);
    }
    const { outcome, view, runId } = await runFor("org_book", "book_club", "live", fakeQloo([...ANCHOR_UNIVERSE]));
    expect(outcome).toBe("SUCCEEDED");
    expect(view.result!.source_mode).toBe("live");
    const { rows } = await admin.query(
      "select distinct source_mode from scb.evidence_records where run_id = $1", [runId]);
    expect(rows.map((r) => r.source_mode)).toEqual(["live"]);
    const { rows: calls } = await admin.query("select call_count from scb.match_runs where id = $1", [runId]);
    expect(calls[0].call_count).toBeLessThanOrEqual(24);
  });

  it("fails visibly instead of substituting synthetic data when the provider is down", async () => {
    const { outcome, view, runId } = await runFor("org_book", "book_club", "live", fakeQloo([], 503));
    expect(outcome).toBe("QLOO_UNAVAILABLE");
    expect(view).toMatchObject({ state: "FAILED", error_code: "QLOO_UNAVAILABLE", result: null });
    const { rows } = await admin.query("select count(*)::int as n from scb.proposals where run_id = $1", [runId]);
    expect(rows[0].n).toBe(0);
  });

  it("fails when no provider is configured", async () => {
    const { outcome } = await runFor("org_book", "book_club", "live", undefined);
    expect(outcome).toBe("QLOO_UNAVAILABLE");
  });
});

describe("job leasing (D10 worker recovery)", () => {
  it("leases a run once and recovers it only after the lease expires", async () => {
    const queued = await ok<{ run_id: string }>(
      api("create_match_run", demo.users.org_film, demo.groups.film_society, "synthetic", randomUUID()));
    expect(await code(api("lease_match_run", queued.run_id))).toBe("OK");
    expect(await code(api("lease_match_run", queued.run_id))).toBe("NOT_READY");
    // A second run for the same group is refused while one is in progress.
    expect(await code(api("create_match_run", demo.users.org_film, demo.groups.film_society, "synthetic", randomUUID())))
      .toBe("RATE_LIMITED");
    await admin.query("update scb.match_runs set lease_until = now() - interval '1 second' where id = $1",
                      [queued.run_id]);
    const recoverable = await ok<{ run_ids: string[] }>(api("list_recoverable_match_runs"));
    expect(recoverable.run_ids).toContain(queued.run_id);
    expect(await processMatchRun(queued.run_id, { pool: app })).toBe("SUCCEEDED");
  });
});

describe("worker crash recovery without duplicates (T14)", () => {
  it("replaying a run after drafts were written creates no duplicate drafts or evidence", async () => {
    const queued = await ok<{ run_id: string }>(
      api("create_match_run", demo.users.org_makers, demo.groups.makers_group, "synthetic", randomUUID()));
    expect(await processMatchRun(queued.run_id, { pool: app })).toBe("SUCCEEDED");
    const count = async () => {
      const { rows } = await admin.query(
        `select (select count(*)::int from scb.proposals where run_id = $1) as drafts,
                (select count(*)::int from scb.evidence_records where run_id = $1) as evidence`, [queued.run_id]);
      return rows[0];
    };
    const before = await count();
    expect(before.drafts).toBeGreaterThan(0);
    // Simulate a worker that wrote drafts and evidence, then died before finishing.
    await admin.query(
      `update scb.match_runs set state = 'RUNNING', lease_until = now() - interval '1 second', result = null
       where id = $1`, [queued.run_id]);
    expect(await processMatchRun(queued.run_id, { pool: app })).toBe("SUCCEEDED");
    expect(await count()).toEqual(before);
  });
});
