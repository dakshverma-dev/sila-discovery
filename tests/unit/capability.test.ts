import { describe, expect, it } from "vitest";
import { signCapability, verifyCapability } from "@/lib/auth/capability";

const key = Buffer.from("k".repeat(48));
const cap = { w: "3f0c1a8e-0d8b-4b8e-9a52-2f8f3f1d9b11", p: "8b6a2d55-7f0e-4d43-b6d2-0d0c5f7b3e21", exp: 2_000_000_000 };

describe("sandbox capability", () => {
  it("round-trips a signed capability", () => {
    expect(verifyCapability(signCapability(cap, key), 0, key)).toEqual(cap);
  });

  it("rejects a tampered payload or signature", () => {
    const token = signCapability(cap, key);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...cap, w: cap.p })).toString("base64url");
    expect(verifyCapability(`${forged}.${sig}`, 0, key)).toBeNull();
    expect(verifyCapability(`${payload}.${sig!.slice(0, -2)}xx`, 0, key)).toBeNull();
    expect(verifyCapability(token, 0, Buffer.from("x".repeat(48)))).toBeNull();
  });

  it("rejects expired or malformed tokens", () => {
    const token = signCapability(cap, key);
    expect(verifyCapability(token, cap.exp * 1000, key)).toBeNull();
    expect(verifyCapability(undefined, 0, key)).toBeNull();
    expect(verifyCapability("a.b.c", 0, key)).toBeNull();
    expect(verifyCapability(signCapability({ ...cap, w: "not-a-uuid" }, key), 0, key)).toBeNull();
  });
});
