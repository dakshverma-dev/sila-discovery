import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Private live checks; loads QLOO_* from .env.local without exposing them elsewhere.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/live/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    env: loadEnv(mode, process.cwd(), "QLOO_"),
  },
}));
