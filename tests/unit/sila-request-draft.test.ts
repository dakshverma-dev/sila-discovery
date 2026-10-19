import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openRequestDraft, sealRequestDraft, type RequestDraft } from "@/lib/sila/request-draft";

const SECRET = "0123456789abcdef0123456789abcdef-test-secret";
const NOW = new Date("2026-10-19T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const draft: RequestDraft = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  clubName: "Club A",
  places: 7,
  email: "organiser@club.example",
  source: "unknown",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  exp: 0,
};

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.SILA_DRAFT_SECRET;
  process.env.SILA_DRAFT_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.SILA_DRAFT_SECRET;
  else process.env.SILA_DRAFT_SECRET = saved;
});

describe("request draft cookie", () => {
  it("round-trips a draft and stamps a 24 hour expiry", () => {
    const token = sealRequestDraft(draft, NOW);
    expect(openRequestDraft(token, NOW)).toEqual({ ...draft, exp: NOW.getTime() + DAY });
  });

  it("returns null for a tampered payload or signature", () => {
    const token = sealRequestDraft(draft, NOW);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...draft, places: 20, exp: NOW.getTime() + 1_000_000 })).toString(
      "base64url",
    );
    expect(openRequestDraft(`${forged}.${sig}`, NOW)).toBeNull();
    const flipped = (sig![0] === "A" ? "B" : "A") + sig!.slice(1);
    expect(openRequestDraft(`${payload}.${flipped}`, NOW)).toBeNull();
    expect(openRequestDraft(`${payload}`, NOW)).toBeNull();
    expect(openRequestDraft("not a token", NOW)).toBeNull();
    expect(openRequestDraft(undefined, NOW)).toBeNull();
    expect(openRequestDraft("", NOW)).toBeNull();
  });

  it("returns null once 24 hours have passed", () => {
    const token = sealRequestDraft(draft, NOW);
    expect(openRequestDraft(token, new Date(NOW.getTime() + DAY - 1))).not.toBeNull();
    expect(openRequestDraft(token, new Date(NOW.getTime() + DAY))).toBeNull();
  });

  it("does not open a token sealed with another secret", () => {
    const token = sealRequestDraft(draft, NOW);
    process.env.SILA_DRAFT_SECRET = "another-secret-another-secret-another-secret";
    expect(openRequestDraft(token, NOW)).toBeNull();
  });

  it("throws at seal when the secret is missing or shorter than 32 characters", () => {
    delete process.env.SILA_DRAFT_SECRET;
    expect(() => sealRequestDraft(draft, NOW)).toThrow(/SILA_DRAFT_SECRET/);
    process.env.SILA_DRAFT_SECRET = "too-short";
    expect(() => sealRequestDraft(draft, NOW)).toThrow(/SILA_DRAFT_SECRET/);
  });

  it("rejects a validly signed payload that is not a draft", () => {
    expect(openRequestDraft(sealRequestDraft({ ...draft, places: 0 }, NOW), NOW)).toBeNull();
    const badSource = sealRequestDraft({ ...draft, source: "other" as RequestDraft["source"] }, NOW);
    expect(openRequestDraft(badSource, NOW)).toBeNull();
  });
});
