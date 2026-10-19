import { resolve } from "node:path";
const config = {
  output: "export",
  poweredByHeader: false,
  agentRules: false,
  turbopack: { root: resolve(import.meta.dirname, "..") },
};
export default config;
