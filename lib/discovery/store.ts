import { Pool, type PoolClient } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { eligibility, placeRequestInput, type DiscoveryInput } from "./rules";
import type { Session } from "./catalog";
import type { DiscoveryResult } from "./workflow";
import type { z } from "zod";

let pool: Pool | undefined;
function database() {
  const url = process.env.DISCOVERY_DATABASE_URL;
  if (!url) throw new Error("Discovery database not configured");
  return (pool ??= new Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    // Server timeout is configured on the dedicated role by discovery/schema.sql.
    // Poolers such as Neon reject a startup `options` statement_timeout parameter.
    query_timeout: 6000,
  }));
}
export class DiscoveryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function scoped<T>(
  owner: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('sila.visitor', $1, true)", [owner]);
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
export async function catalogue(): Promise<Session[]> {
  const result = await database().query<{ snapshot: Session }>(
    "select snapshot from discovery.sessions order by id",
  );
  return result.rows.map((row) => row.snapshot);
}
export async function reserveProviderCalls() {
  const limit = Number(process.env.DISCOVERY_PROVIDER_DAILY_LIMIT || 500);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    throw new Error("Invalid daily provider budget");
  const { rows } = await database().query<{ allowed: boolean }>(
    "select discovery.reserve_provider_calls($1) as allowed",
    [limit],
  );
  if (!rows[0]?.allowed)
    throw new DiscoveryError(
      429,
      "The demo's daily Qloo allowance is used. Please browse the unranked collection or return tomorrow (UTC).",
    );
}
export async function consumeDiscoveryQuota(owner: string) {
  return scoped(owner, async (client) => {
    const { rows } = await client.query<{ used: number }>(
      `insert into discovery.quota(owner, bucket, used)
      values($1, date_trunc('hour', now()), 1)
      on conflict(owner, bucket) do update set used=discovery.quota.used+1
      returning used`,
      [owner],
    );
    if ((rows[0]?.used ?? 21) > 20)
      throw new DiscoveryError(
        429,
        "You have reached 20 discoveries this hour. Please try again later.",
      );
  });
}
export async function saveRun(
  owner: string,
  input: DiscoveryInput,
  result: DiscoveryResult,
) {
  return scoped(owner, async (client) => {
    const id = randomUUID();
    await client.query(
      "insert into discovery.runs(id,owner,input,result) values($1,$2,$3,$4)",
      [id, owner, JSON.stringify(input), JSON.stringify(result)],
    );
    return id;
  });
}
export async function getRun(owner: string, id: string) {
  return scoped(owner, async (client) => {
    const { rows } = await client.query<{
      id: string;
      input: DiscoveryInput;
      result: DiscoveryResult;
    }>(
      "select id,input,result from discovery.runs where id=$1 and owner=$2 and created_at > now() - interval '24 hours'",
      [id, owner],
    );
    return rows[0] ?? null;
  });
}
export type PlaceRequest = {
  id: string;
  status: "conditional";
  clubName: string;
  session: Session;
  places: number;
  totalPence: number;
  createdAt: string;
};
export async function createPlaceRequest(
  owner: string,
  input: z.infer<typeof placeRequestInput>,
): Promise<PlaceRequest> {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        runId: input.runId,
        sessionId: input.sessionId,
        places: input.places,
        price: input.expectedPricePence,
        version: input.expectedVersion,
      }),
    )
    .digest("hex");
  return scoped(owner, async (client) => {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [owner],
    );
    const previous = await client.query<{
      fingerprint: string;
      snapshot: PlaceRequest;
    }>(
      "select fingerprint,snapshot from discovery.requests where owner=$1 and request_key=$2",
      [owner, input.requestKey],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].fingerprint !== fingerprint)
        throw new DiscoveryError(
          409,
          "This request key was already used for different details.",
        );
      return previous.rows[0].snapshot;
    }
    const run = await client.query<{
      input: DiscoveryInput;
      result: DiscoveryResult;
    }>(
      "select input,result from discovery.runs where id=$1 and owner=$2 and created_at > now() - interval '24 hours'",
      [input.runId, owner],
    );
    const found = run.rows[0];
    if (
      !found ||
      !found.result.recommendations.some((s) => s.id === input.sessionId)
    )
      throw new DiscoveryError(
        404,
        "Recommendation not found. Run discovery again.",
      );
    const record = await client.query<{ snapshot: Session }>(
      "select discovery.locked_session($1) as snapshot",
      [input.sessionId],
    );
    const session = record.rows[0]?.snapshot;
    if (
      !session ||
      input.places !== found.input.places ||
      input.expectedVersion !== session.version ||
      input.expectedPricePence !== session.pricePence ||
      eligibility(session, found.input).length
    ) {
      throw new DiscoveryError(
        409,
        "Session details or sample availability changed. Run discovery again before requesting.",
      );
    }
    const snapshot: PlaceRequest = {
      id: randomUUID(),
      status: "conditional",
      clubName: found.input.clubName,
      session,
      places: input.places,
      totalPence: session.pricePence * input.places,
      createdAt: new Date().toISOString(),
    };
    await client.query(
      "insert into discovery.requests(id,owner,request_key,fingerprint,snapshot) values($1,$2,$3,$4,$5)",
      [
        snapshot.id,
        owner,
        input.requestKey,
        fingerprint,
        JSON.stringify(snapshot),
      ],
    );
    return snapshot;
  });
}
export async function getPlaceRequest(
  owner: string,
  id: string,
): Promise<PlaceRequest | null> {
  return scoped(owner, async (client) => {
    const { rows } = await client.query<{ snapshot: PlaceRequest }>(
      "select snapshot from discovery.requests where id=$1 and owner=$2",
      [id, owner],
    );
    return rows[0]?.snapshot ?? null;
  });
}
