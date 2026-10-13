import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    data: { status: "ok" },
    meta: { request_id: randomUUID() },
  });
}
