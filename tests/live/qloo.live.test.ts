import { describe, expect, it } from "vitest";
import { CallBudget } from "@/lib/providers/qloo/client";
import { qlooClientOrNull } from "@/lib/providers/qloo/server";

/*
 * PRIVATE live contract check (D11 release check, RISK11). Runs only when
 * QLOO_API_KEY is set. Prints field names and counts, never response bodies;
 * do not paste its output anywhere public if it ever includes titles.
 * Run with: npm run test:live
 */

const client = qlooClientOrNull();

function shape(value: unknown, depth = 0): string {
  if (depth > 2 || value === null || typeof value !== "object") return typeof value;
  if (Array.isArray(value)) return `array(${value.length})<${value.length ? shape(value[0], depth + 1) : "empty"}>`;
  return `{${Object.keys(value).sort().join(",")}}`;
}

describe.skipIf(!client)("Qloo hackathon API live contract", () => {
  const budget = new CallBudget(12, Date.now() + 120_000);

  it("resolves entities with /search and ranks a fixed book universe with /v2/insights", async () => {
    const books = ["Pride and Prejudice", "The Hobbit", "Dracula", "Frankenstein"];
    const bookIds: string[] = [];
    for (const title of books) {
      const r = await client!.search(title, budget, { take: 3, types: ["urn:entity:book"] });
      console.log(`search(book) -> ${r.candidates.length} candidates; first entry fields: ${shape(r.candidates[0])}`);
      if (r.candidates[0]) bookIds.push(r.candidates[0].entity_id);
    }
    expect(bookIds.length, "book search should resolve at least two anchors").toBeGreaterThanOrEqual(2);

    const film = await client!.search("Spirited Away", budget, { take: 3 });
    console.log(`search(any) -> ${film.candidates.length} candidates; types seen: ${[...new Set(film.candidates.flatMap((c) => c.types))].join(",")}`);
    const signal = film.candidates[0]?.entity_id ?? bookIds[0]!;

    const ranked = await client!.rankAnchors([signal], bookIds, budget);
    const returned = new Set(ranked.entities.map((e) => e.entity_id));
    console.log(JSON.stringify({
      universe: bookIds.length,
      returned: ranked.entities.length,
      complete_universe: bookIds.every((id) => returned.has(id)),
      unexpected_entities: ranked.entities.filter((e) => !bookIds.includes(e.entity_id)).length,
      affinity_present: ranked.entities.filter((e) => typeof e.raw_score === "number").length,
      calls_used: budget.callsUsed,
      source_mode: ranked.meta.source_mode,
    }));
    expect(ranked.meta.source_mode).toBe("live");
    expect(ranked.entities.length).toBeGreaterThan(0);
  });
});

describe.runIf(!client)("Qloo live contract (skipped)", () => {
  it("needs QLOO_API_KEY in the environment or .env.local", () => {
    expect(client).toBeNull();
  });
});
