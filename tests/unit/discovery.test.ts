import { afterEach, describe, expect, it, vi } from "vitest";
import { sessions, venues } from "@/lib/discovery/catalog";
import { discoveryInput, eligibility, recommend } from "@/lib/discovery/rules";
import {
  proveInterest,
  readInterest,
  sign,
  verify,
} from "@/lib/discovery/identity";
import { buildPlaceInsightsParams } from "@/lib/providers/qloo/request";
import { randomUUID } from "node:crypto";

const input = {
  clubName: "Fictional Club",
  interestEntityIds: ["real-id"],
  interestProofs: ["proof"],
  city: "Edinburgh" as const,
  startDate: "2026-11-19",
  endDate: "2026-11-22",
  places: 7,
  maxPricePence: 3500,
  useAssistant: false,
};
const ids = (names: string[]) =>
  names.map((name) => venues.find((v) => v.id === name)!.qlooId);
afterEach(() => vi.unstubAllEnvs());
describe("discovery eligibility and provider order", () => {
  it("filters expensive and undersized sessions while retaining provider order", () => {
    const result = recommend(
      sessions,
      ids(["printmakers", "museum", "garden", "fruitmarket", "stills"]),
      input,
    );
    expect(result.recommendations.map((s) => s.venueId)).toEqual([
      "museum",
      "garden",
      "fruitmarket",
    ]);
    expect(
      result.exclusions.find((e) => e.sessionId === "print-room")?.reasons,
    ).toContain("Above your per-person budget");
    expect(
      result.exclusions.find((e) => e.sessionId === "photography")?.reasons,
    ).toContain("Not enough sample places");
  });
  it("changes first recommendation when the provider order changes", () => {
    expect(
      recommend(sessions, ids(["garden", "fruitmarket", "museum"]), input)
        .recommendations[0]?.venueId,
    ).toBe("garden");
    expect(
      recommend(sessions, ids(["fruitmarket", "garden", "museum"]), input)
        .recommendations[0]?.venueId,
    ).toBe("fruitmarket");
  });
  it("does not invent ranking for a mapped venue omitted by Qloo", () => {
    const result = recommend(sessions, ids(["garden"]), input);
    expect(result.recommendations.map((s) => s.venueId)).toEqual(["garden"]);
    expect(
      result.exclusions.find((e) => e.sessionId === "museum-stories")?.reasons,
    ).toContain("Qloo returned no ranking for this venue");
  });
  it("returns no recommendations for a £10 budget", () =>
    expect(
      recommend(sessions, ids(["garden", "fruitmarket", "museum"]), {
        ...input,
        maxPricePence: 1000,
      }).recommendations,
    ).toEqual([]));
  it("rejects cancelled, unmapped and out-of-window records", () => {
    const sample = sessions[0]!;
    expect(
      eligibility(
        {
          ...sample,
          venueId: "unmapped",
          status: "cancelled",
          startsAt: "2026-11-23T00:00:00Z",
        },
        input,
      ),
    ).toEqual(
      expect.arrayContaining([
        "Venue has no verified Qloo mapping",
        "Session is closed",
        "Outside your dates",
      ]),
    );
  });
  it("uses London local dates across British Summer Time", () => {
    const sample = { ...sessions[1]!, startsAt: "2026-06-01T23:30:00Z" };
    expect(
      eligibility(sample, {
        ...input,
        startDate: "2026-06-02",
        endDate: "2026-06-02",
      }),
    ).toEqual([]);
    expect(
      eligibility(sample, {
        ...input,
        startDate: "2026-06-01",
        endDate: "2026-06-01",
      }),
    ).toContain("Outside your dates");
  });
});
describe("discovery input boundaries", () => {
  it.each([
    { places: 0 },
    { places: 13 },
    { places: 2.5 },
    { maxPricePence: 12.5 },
    { maxPricePence: -1 },
    { city: "London" },
    { startDate: "2026-02-30" },
    { endDate: "2026-11-18" },
    { endDate: "2026-12-21" },
    { interestEntityIds: [] },
    {
      interestEntityIds: ["duplicate", "duplicate"],
      interestProofs: ["a", "b"],
    },
  ])("rejects invalid fields %j", (fields) =>
    expect(discoveryInput.safeParse({ ...input, ...fields }).success).toBe(
      false,
    ),
  );
  it("rejects unknown command fields", () =>
    expect(
      discoveryInput.safeParse({ ...input, confirmBooking: true }).success,
    ).toBe(false));
  it("accepts a valid exact minor-unit budget", () =>
    expect(discoveryInput.parse(input).maxPricePence).toBe(3500));
  it("builds a place query without club or personal data", () => {
    const params = buildPlaceInsightsParams(["taste-id"], ["venue-id"]);
    expect(params.get("filter.type")).toBe("urn:entity:place");
    expect(params.get("filter.results.entities")).toBe("venue-id");
    expect(params.get("sort_by")).toBe("affinity");
    expect(() => buildPlaceInsightsParams(["bad,id"], ["venue-id"])).toThrow();
  });
});
describe("signed visitor and interest provenance", () => {
  const owner = randomUUID(),
    stranger = randomUUID();
  const interest = {
    entityId: "qloo-id",
    name: "A genuine search result",
    type: "urn:entity:movie",
  };
  it("binds a signed selection to the visitor", () => {
    vi.stubEnv(
      "DISCOVERY_COOKIE_SECRET",
      "test-only-secret-of-at-least-32-characters",
    );
    const proof = proveInterest(interest, owner);
    expect(readInterest(proof, owner)).toEqual(interest);
    expect(readInterest(proof, stranger)).toBeNull();
    expect(readInterest(proof + "tampered", owner)).toBeNull();
    expect(verify(sign(owner))).toBe(owner);
  });
  it("expires selections after an hour", () => {
    vi.stubEnv(
      "DISCOVERY_COOKIE_SECRET",
      "test-only-secret-of-at-least-32-characters",
    );
    const proof = proveInterest(interest, owner);
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600001);
    expect(readInterest(proof, owner)).toBeNull();
    clock.mockRestore();
  });
});
