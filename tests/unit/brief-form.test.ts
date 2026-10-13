import { describe, expect, it } from "vitest";
import { parseBriefForm } from "@/lib/demo/brief-form";
import { londonToUtc } from "@/lib/demo/catalogue";

function form(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const base = {
  budget: "22.00",
  expected_seats: "8",
  sharing_choice: "WILLING_TO_SHARE",
  access: ["seating"],
  window_0_date: "2026-12-05",
  window_0_start: "13:00",
  window_0_end: "17:00",
};

describe("brief form parsing (R03)", () => {
  it("converts Edinburgh wall-clock windows to UTC and pounds to pence", () => {
    const r = parseBriefForm(form(base));
    expect(r.ok && r.brief).toMatchObject({
      budget_pence: 2200,
      expected_seats: 8,
      access_requirements: ["seating"],
      availability: [{ start_at: "2026-12-05T13:00:00.000Z", end_at: "2026-12-05T17:00:00.000Z" }],
      external_query_consent: false,
    });
  });

  it("handles British Summer Time", () => {
    expect(londonToUtc(new Date(Date.UTC(2026, 6, 4)), 14, 0)).toBe("2026-07-04T13:00:00.000Z");
    expect(londonToUtc(new Date(Date.UTC(2026, 11, 5)), 14, 0)).toBe("2026-12-05T14:00:00.000Z");
  });

  it("reports each invalid field without guessing", () => {
    const r = parseBriefForm(form({ ...base, budget: "-3", expected_seats: "0", window_0_end: "12:00", sharing_choice: "maybe" }));
    expect(r).toEqual({ ok: false, fields: ["budget", "expected_seats", "sharing_choice", "window_0"] });
  });

  it("rejects unknown access needs", () => {
    expect(parseBriefForm(form({ ...base, access: ["teleporter"] }))).toMatchObject({ ok: false, fields: ["access"] });
  });

  it("only marks a reference resolved when it carries a provider ID and type", () => {
    const r = parseBriefForm(form({
      ...base,
      ref_0_label: "A novel",
      ref_0_meaning: "Read together last winter",
      ref_1_label: "A film",
      ref_1_entity: "E1",
      ref_1_subtype: "urn:entity:movie",
    }));
    expect(r.ok && r.brief.references).toEqual([
      { input_label: "A novel", declared_meaning: "Read together last winter", entity_id: null, subtype: null, resolved: false },
      { input_label: "A film", declared_meaning: null, entity_id: "E1", subtype: "urn:entity:movie", resolved: true },
    ]);
  });
});
