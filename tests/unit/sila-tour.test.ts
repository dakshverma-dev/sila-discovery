import { describe, expect, it } from "vitest";
import { advanceTour, initialTour, tourStep } from "@/lib/sila/tour";

describe("synthetic customer tour (§07, §16, §27)", () => {
  it("keeps each commercial action with its actor and reaches a confirmed example", () => {
    let state = initialTour();
    for (let i = 0; i < 13; i++) state = advanceTour(state);
    expect(tourStep(state).title).toBe("Now it is confirmed");
    expect(advanceTour(state)).toEqual(initialTour());
  });
  it("does not advance the wrong role and keeps refund due different from verified", () => {
    const wrong = { ...initialTour(), actor: "club-a" as const };
    expect(advanceTour(wrong)).toBe(wrong);
    let state = initialTour("refund");
    for (let i = 0; i < 11; i++) state = advanceTour(state);
    expect(tourStep(state).title).toBe("£61.25 due back to Club A");
    state = advanceTour(state);
    expect(tourStep(state).title).toBe("Refund verified");
    expect(advanceTour(state)).toEqual(initialTour("refund"));
  });
});
