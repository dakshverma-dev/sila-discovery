import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The synthetic demo can run beside ordinary development without sharing
  // Next's dev-server lock or compiled authentication configuration.
  distDir: process.env.SILA_DEMO_MODE === "local" ? ".next-demo" : ".next",
  poweredByHeader: false,
  // AGENTS.md is the project's canonical instruction file; stop next dev appending to it.
  agentRules: false,
  // Provider keys are read only in server modules; never expose them via env here.
};

export default nextConfig;
