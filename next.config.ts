import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // AGENTS.md is the project's canonical instruction file; stop next dev appending to it.
  agentRules: false,
  // Provider keys are read only in server modules; never expose them via env here.
};

export default nextConfig;
