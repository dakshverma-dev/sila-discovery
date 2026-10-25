import { z } from "zod";
import { visitor } from "@/lib/discovery/identity";
import { failure, json } from "@/lib/discovery/http";
import { getPlaceRequest } from "@/lib/discovery/store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const owner = await visitor(false);
    const record =
      owner && z.uuid().safeParse(id).success
        ? await getPlaceRequest(owner, id)
        : null;
    return record ? json(record) : json({ error: "Request not found" }, 404);
  } catch (error) {
    return failure(error);
  }
}
