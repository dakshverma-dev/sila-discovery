import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Provider keys are read only in server modules; never expose them via env here.
};

export default nextConfig;
