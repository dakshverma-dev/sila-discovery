import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests against a local Supabase database (`npx supabase start`).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
