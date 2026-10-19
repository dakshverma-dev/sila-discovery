import { beforeEach, describe, expect, it, vi } from "vitest";

const callSila = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sila/db", () => ({ callSila }));

const { confirmSession, confirmationKey, recordReceipt, reportPayment } = await import("@/lib/sila/commands/receipts");

const actor = { personId: "00000000-0000-4000-8000-0000000000aa", email: "f@test.example" };
const receivedAt = new Date("2026-11-10T11:00:00.000Z");
const input = {
  allocationId: "a1", kind: "deposit" as const, amountMinor: 7875, receivedAt, receiptId: "RC-2026-B",
  evidence: "Statement line", confirmWhenReady: true, diaryChecked: true, expectedSessionVersion: 7,
};
const saved = { entry_id: "e1", allocation_id: "a1", session_id: "s1", timely: true };
const notReady = (blockers: unknown[]) => ({
  ok: false, error: { code: "NOT_READY", message: "This session cannot be confirmed yet.", retryable: false,
                      details: { blockers } },
});

beforeEach(() => callSila.mockReset());

describe("receipt commands", () => {
  it("passes report_payment arguments in the database order", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: {} });
    await reportPayment(actor, "key-12345678", { allocationId: "a1", kind: "deposit", amountMinor: 6125,
                                                 reference: "BACS" });
    expect(callSila).toHaveBeenCalledWith("report_payment", [actor.personId, "key-12345678", "a1", "deposit", 6125,
                                                             "BACS"]);
  });

  it("records the receipt only when confirmWhenReady is false", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: saved });
    const r = await recordReceipt(actor, "key-12345678", { ...input, confirmWhenReady: false });
    expect(callSila).toHaveBeenCalledTimes(1);
    expect(callSila).toHaveBeenCalledWith("record_receipt", [actor.personId, "key-12345678", "a1", "deposit", 7875,
                                                             receivedAt, "RC-2026-B", "Statement line"]);
    expect(r).toEqual({ ok: true, data: { receipt: saved, confirmation: null, confirmation_blockers: [],
                                          confirmation_error: null } });
  });

  it("confirms with a derived key after the receipt is saved", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: saved })
      .mockResolvedValueOnce({ ok: true, data: { booking_id: "b1", booking_ref: "SL1042" } });
    const r = await recordReceipt(actor, "key-12345678", input);
    expect(callSila).toHaveBeenLastCalledWith("confirm_session", [actor.personId, "key-12345678:confirm", "s1", 7,
                                                                  true]);
    expect(r.ok && r.data).toMatchObject({ confirmation: { booking_ref: "SL1042" }, confirmation_blockers: [] });
  });

  it("keeps the receipt and returns the blockers when confirmation is not ready", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: saved })
      .mockResolvedValueOnce(notReady([{ code: "RESOURCE_HOLD_EXPIRED" },
                                       { code: "DEPOSIT_NOT_VERIFIED", allocation_id: "a2" }]));
    const r = await recordReceipt(actor, "key-12345678", input);
    expect(r).toEqual({ ok: true, data: {
      receipt: saved, confirmation: null, confirmation_error: null,
      confirmation_blockers: [{ code: "RESOURCE_HOLD_EXPIRED" }, { code: "DEPOSIT_NOT_VERIFIED", allocationId: "a2" }],
    } });
  });

  it("keeps the receipt and reports any other confirmation failure separately", async () => {
    callSila.mockResolvedValueOnce({ ok: true, data: saved })
      .mockResolvedValueOnce({ ok: false, error: { code: "NOT_FOUND", message: "Not found.", retryable: false } });
    const r = await recordReceipt(actor, "key-12345678", input);
    expect(r.ok && r.data).toMatchObject({ receipt: saved, confirmation: null, confirmation_blockers: [],
                                           confirmation_error: { code: "NOT_FOUND" } });
  });

  it("returns a failed receipt unchanged and does not try to confirm", async () => {
    const dup = { ok: false, error: { code: "DUPLICATE_RECEIPT", message: "Duplicate.", retryable: false } };
    callSila.mockResolvedValueOnce(dup);
    expect(await recordReceipt(actor, "key-12345678", input)).toEqual(dup);
    expect(callSila).toHaveBeenCalledTimes(1);
  });

  it("keeps derived keys within the 200-character idempotency limit", () => {
    expect(confirmationKey("key-12345678")).toBe("key-12345678:confirm");
    const long = "k".repeat(200);
    const derived = confirmationKey(long);
    expect(derived.length).toBeLessThanOrEqual(200);
    expect(derived).toBe(confirmationKey(long));
    expect(derived).not.toBe(confirmationKey("j".repeat(200)));
  });

  it("maps confirm_session blockers to BlockerDetail", async () => {
    callSila.mockResolvedValueOnce(notReady([{ code: "DIARY_NOT_CHECKED" }]));
    const r = await confirmSession(actor, "key-12345678", "s1", 3, false);
    expect(callSila).toHaveBeenCalledWith("confirm_session", [actor.personId, "key-12345678", "s1", 3, false]);
    expect(!r.ok && r.error.details).toEqual({ blockers: [{ code: "DIARY_NOT_CHECKED" }] });
  });
});
