import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { callApi, type ApiFunction, type ApiResult } from "@/lib/db/api";
import { buildDemoDefinition } from "@/lib/demo/catalogue";

export const ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const APP_URL =
  process.env.DATABASE_URL ?? "postgresql://scb_app_login:scb_local_dev_only@127.0.0.1:54322/postgres";

export const admin = new Pool({ connectionString: ADMIN_URL, max: 4 });
export const app = new Pool({ connectionString: APP_URL, max: 12 });

export function key(): string {
  return `test-${randomUUID()}`;
}

export function api<T = Record<string, unknown>>(fn: ApiFunction, ...args: unknown[]): Promise<ApiResult<T>> {
  return callApi<T>(fn, args, app);
}

export async function ok<T = Record<string, unknown>>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`Expected success, got ${r.error.code}: ${r.error.message}`);
  return r.data;
}

export async function code(p: Promise<ApiResult<unknown>>): Promise<string> {
  const r = await p;
  return r.ok ? "OK" : r.error.code;
}

export interface Demo {
  workspace_id: string;
  users: Record<string, string>;
  groups: Record<string, string>;
  experiences: Record<string, string>;
  slots: Record<string, string>;
}

export async function createDemo(definition = buildDemoDefinition()): Promise<Demo> {
  return ok<Demo>(api("create_demo_workspace", definition));
}

export async function currentQuoteId(demo: Demo, experienceKey: string): Promise<string> {
  const { rows } = await admin.query(
    "select id from scb.quotes where experience_id = $1 order by version desc limit 1",
    [demo.experiences[experienceKey]],
  );
  return rows[0].id;
}

export const COALITION = ["book_club", "film_society", "makers_group"] as const;

/** Saves the fixture-equivalent three-group draft for the curator session. */
export async function saveCuratorDraft(demo: Demo, groups: readonly string[] = COALITION) {
  const quote = await currentQuoteId(demo, "curator_session");
  const { rows } = await admin.query("select scb.quote_required_seats($1, 30) as n", [quote]);
  const required: number = rows[0].n;
  return ok<{ proposal_id: string; proposal_version_id: string }>(
    api("save_draft", demo.users.org_book, demo.workspace_id, demo.slots.curator_session_1, quote,
        groups.map((g) => demo.groups[g]), required, "synthetic", { note: "test" }, null, randomUUID()),
  );
}

export function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function publish(demo: Demo, proposalId: string, deadline = inDays(7)) {
  return ok<{ proposal_version_id: string; version: number }>(
    api("publish_proposal", demo.users.venue_manager, proposalId, deadline, randomUUID(), key()),
  );
}

export const ORGANISERS: Record<string, string> = {
  book_club: "org_book",
  film_society: "org_film",
  makers_group: "org_makers",
};

export async function acceptAll(demo: Demo, proposalId: string, versionId: string, version = 1,
                                groups: readonly string[] = COALITION) {
  for (const g of groups) {
    await ok(api("respond_to_proposal", demo.users[ORGANISERS[g]!], proposalId, versionId, version,
                 demo.groups[g], "ACCEPT", null, null, randomUUID(), key()));
  }
}

/** Every person (organiser and participants) in a group, by user ID. */
export function people(demo: Demo, group: string): string[] {
  const prefix = `${group}_p`;
  return [demo.users[ORGANISERS[group]!]!,
    ...Object.entries(demo.users).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v)];
}

export function reserve(demo: Demo, actor: string, proposalId: string, versionId: string, group: string,
                        version = 1, idem = key()) {
  return api<{ reservation_id: string; state: string }>("reserve_seat", actor, proposalId, versionId, version,
                                                        demo.groups[group], true, true, randomUUID(), idem);
}

export async function proposalState(proposalId: string): Promise<string> {
  const { rows } = await admin.query("select state from scb.proposals where id = $1", [proposalId]);
  return rows[0].state;
}
