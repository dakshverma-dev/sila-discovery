import { describe, expect, it } from "vitest";
import { localDemoEnabled } from "@/lib/sila/demo";

const local = {
  SILA_DEMO_MODE: "local", DATABASE_URL: "postgresql://app:local@127.0.0.1:56322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56321", APP_BASE_URL: "http://localhost:3300",
};

describe("local-only demo isolation (§22, §27)", () => {
  it("allows explicitly enabled loopback services", () => expect(localDemoEnabled(local)).toBe(true));
  it("defaults off and rejects a hosted target even when demo mode is requested", () => {
    expect(localDemoEnabled({})).toBe(false);
    expect(localDemoEnabled({ ...local, SILA_DEMO_MODE: "false" })).toBe(false);
    for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "APP_BASE_URL"]) {
      expect(localDemoEnabled({ ...local, [key]: "https://production.example" })).toBe(false);
      expect(localDemoEnabled({ ...local, [key]: "invalid" })).toBe(false);
      expect(localDemoEnabled({ ...local, [key]: "" })).toBe(false);
    }
  });
});
