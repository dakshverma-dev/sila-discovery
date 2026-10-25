import { CallBudget, QlooClient } from "@/lib/providers/qloo/client";
import { qlooConfigFromEnv } from "@/lib/providers/qloo/config";
import { proveInterest, visitor } from "@/lib/discovery/identity";
import { failure, guard, json } from "@/lib/discovery/http";
import { DiscoveryError, reserveProviderCalls } from "@/lib/discovery/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const owner = (await visitor())!;
    guard(request, owner, 30);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2 || query.length > 100)
      throw new DiscoveryError(422, "Search for 2–100 characters.");
    await reserveProviderCalls();
    const result = await new QlooClient(qlooConfigFromEnv()).search(
      query,
      new CallBudget(2, Date.now() + 16000),
      { take: 6 },
    );
    return json({
      sourceMode: "live",
      candidates: result.candidates.map((c) => {
        const interest = {
          entityId: c.entity_id,
          name: c.name,
          type: c.types[0] ?? "unknown",
        };
        return { ...interest, proof: proveInterest(interest, owner) };
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
