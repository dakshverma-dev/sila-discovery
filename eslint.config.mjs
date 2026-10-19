import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", ".next-demo/**", ".supabase/**", ".claude/**", "customer-demo/.next/**", "customer-demo/out/**", "test-results/**", "node_modules/**", "specs/**", "docs/**", "word/**", "diagrams/**", "Design/**"] },
];

export default config;
