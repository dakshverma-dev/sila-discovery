import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/sila/auth";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/plans/1")).toBe("/plans/1");
    expect(safeNextPath("/s/abc?x=1#top")).toBe("/s/abc?x=1#top");
  });

  it("falls back to the home page for anything that could leave the site", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects control characters the URL parser would strip", () => {
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
    expect(safeNextPath("/\r/evil.example")).toBe("/");
    expect(safeNextPath("/\u0000/evil.example")).toBe("/");
    expect(safeNextPath("/\u007f/evil.example")).toBe("/");
    expect(safeNextPath("/ok\tpath")).toBe("/");
  });

  it("keeps ordinary paths with a query string", () => {
    expect(safeNextPath("/plans/1?x=1")).toBe("/plans/1?x=1");
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
  });

  it("falls back for other off-site shapes", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
