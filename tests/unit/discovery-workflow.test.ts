import { afterEach, describe, expect, it, vi } from "vitest";
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));
import { discover, validFinalIds } from "@/lib/discovery/workflow";
import { QlooClient } from "@/lib/providers/qloo/client";
import { sessions, venues } from "@/lib/discovery/catalog";

const input = {
  clubName: "Fictional Club",
  interestEntityIds: ["taste-id"],
  interestProofs: ["proof"],
  city: "Edinburgh" as const,
  startDate: "2026-11-19",
  endDate: "2026-11-22",
  places: 7,
  maxPricePence: 3500,
  useAssistant: false,
};
function provider() {
  vi.stubEnv("QLOO_API_KEY", "test-key-never-live");
  vi.spyOn(QlooClient.prototype, "rankPlaces").mockResolvedValue({
    entities: [venues[2], venues[4], venues[1]].map((v, i) => ({
      entity_id: v.qlooId,
      name: v.name,
      rank: i + 1,
    })),
    meta: {
      source_mode: "live",
      fetched_at: "2026-10-25T00:00:00Z",
      query_fingerprint: "unit-fixture-not-live",
    },
  });
}
const tool = {
  content: [
    { type: "tool_use", id: "tool-1", name: "discover_sessions", input: {} },
  ],
  stop_reason: "tool_use",
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  create.mockReset();
});
describe("bounded assistant contract (mocked, never live evidence)", () => {
  it("reports no configured model honestly and still uses the real discovery path", async () => {
    provider();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await discover(
      { ...input, useAssistant: true },
      [],
      sessions,
    );
    expect(result.assistant.status).toBe("not_configured");
    expect(create).not.toHaveBeenCalled();
  });
  it("accepts only the exact eligible provider order", async () => {
    provider();
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-unit-key");
    create
      .mockResolvedValueOnce(tool)
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sessionIds: ["garden-art", "gallery-evening", "museum-stories"],
            }),
          },
        ],
        stop_reason: "end_turn",
      });
    const result = await discover(
      { ...input, useAssistant: true },
      [],
      sessions,
    );
    expect(result.assistant.status).toBe("verified");
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("falls back on invented IDs instead of accepting model facts", async () => {
    provider();
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-unit-key");
    create
      .mockResolvedValueOnce(tool)
      .mockResolvedValueOnce({
        content: [
          { type: "text", text: '{"sessionIds":["invented-booking"]}' },
        ],
        stop_reason: "end_turn",
      });
    const result = await discover(
      { ...input, useAssistant: true },
      [],
      sessions,
    );
    expect(result.assistant.status).toBe("fallback");
    expect(result.recommendations[0]?.id).toBe("garden-art");
  });
  it("fails closed when the provider fails before any results", async () => {
    provider();
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-unit-key");
    vi.mocked(QlooClient.prototype.rankPlaces).mockRejectedValue(
      new Error("simulated provider timeout"),
    );
    create.mockResolvedValueOnce(tool);
    await expect(
      discover({ ...input, useAssistant: true }, [], sessions),
    ).rejects.toThrow("could not complete");
  });
  it("caps tool calls at three even when the model repeats", async () => {
    provider();
    vi.stubEnv("ANTHROPIC_API_KEY", "fake-unit-key");
    create
      .mockResolvedValueOnce(tool)
      .mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "more",
            name: "get_session",
            input: { sessionId: "garden-art" },
          },
        ],
        stop_reason: "tool_use",
      });
    const result = await discover(
      { ...input, useAssistant: true },
      [],
      sessions,
    );
    expect(result.assistant.status).toBe("fallback");
    expect(result.trace.filter((t) => t.tool === "get_session")).toHaveLength(
      2,
    );
    expect(create).toHaveBeenCalledTimes(4);
  });
  it("rejects reordered, truncated and duplicate final IDs", () => {
    expect(validFinalIds(["b", "a"], ["a", "b"])).toBe(false);
    expect(validFinalIds(["a"], ["a", "b"])).toBe(false);
    expect(validFinalIds(["a", "a"], ["a", "b"])).toBe(false);
  });
});
