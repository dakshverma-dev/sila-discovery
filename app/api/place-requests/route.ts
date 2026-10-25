import { placeRequestInput } from "@/lib/discovery/rules";
import { visitor } from "@/lib/discovery/identity";
import { body, failure, guard, json } from "@/lib/discovery/http";
import { createPlaceRequest } from "@/lib/discovery/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const owner = (await visitor())!;
    guard(request, owner);
    const result = await createPlaceRequest(
      owner,
      placeRequestInput.parse(await body(request)),
    );
    return json(result, 201);
  } catch (error) {
    return failure(error);
  }
}
