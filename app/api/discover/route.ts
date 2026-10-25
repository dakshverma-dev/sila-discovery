import { discoveryInput } from "@/lib/discovery/rules";
import { readInterest, visitor } from "@/lib/discovery/identity";
import { body, failure, guard, json } from "@/lib/discovery/http";
import {
  catalogue,
  consumeDiscoveryQuota,
  DiscoveryError,
  reserveProviderCalls,
  saveRun,
} from "@/lib/discovery/store";
import { discover } from "@/lib/discovery/workflow";
export const runtime = "nodejs";
export const maxDuration = 40;
export async function POST(request: Request) {
  try {
    const owner = (await visitor())!;
    guard(request, owner, 5);
    const input = discoveryInput.parse(await body(request));
    const interests = input.interestProofs.map((proof) =>
      readInterest(proof, owner),
    );
    if (
      interests.some(
        (interest, i) =>
          !interest || interest.entityId !== input.interestEntityIds[i],
      )
    )
      throw new DiscoveryError(
        422,
        "Select interests from search again; your selection may have expired.",
      );
    await consumeDiscoveryQuota(owner);
    await reserveProviderCalls();
    const result = await discover(
      input,
      interests.filter((i) => i !== null),
      await catalogue(),
    );
    const runId = await saveRun(owner, input, result);
    return json({ runId, ...result });
  } catch (error) {
    return failure(error);
  }
}
