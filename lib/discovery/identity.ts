import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

const signedInterest = z.object({
  entityId: z.string(),
  name: z.string().max(200),
  type: z.string(),
  owner: z.uuid(),
  expires: z.number(),
});
export type Interest = Pick<
  z.infer<typeof signedInterest>,
  "entityId" | "name" | "type"
>;
function mac(value: string) {
  const secret = process.env.DISCOVERY_COOKIE_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Discovery cookie secret not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}
export function sign(value: string) {
  return `${value}.${mac(value)}`;
}
export function verify(token: string): string | null {
  const [value, signature, extra] = token.split(".");
  if (!value || !signature || extra) return null;
  const a = Buffer.from(signature),
    b = Buffer.from(mac(value));
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}
export async function visitor(create = true): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get("sila-discovery-visitor")?.value;
  const id = token ? verify(token) : null;
  if (id && z.uuid().safeParse(id).success) return id;
  if (!create) return null;
  const fresh = randomUUID();
  jar.set("sila-discovery-visitor", sign(fresh), {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" && !process.env.DISCOVERY_LOCAL,
    path: "/",
    maxAge: 7 * 86400,
  });
  return fresh;
}
export function proveInterest(interest: Interest, owner: string) {
  return sign(
    Buffer.from(
      JSON.stringify({ ...interest, owner, expires: Date.now() + 3600000 }),
    ).toString("base64url"),
  );
}
export function readInterest(proof: string, owner: string): Interest | null {
  const value = verify(proof);
  if (!value) return null;
  try {
    const p = signedInterest.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return p.owner === owner && p.expires > Date.now()
      ? { entityId: p.entityId, name: p.name, type: p.type }
      : null;
  } catch {
    return null;
  }
}
