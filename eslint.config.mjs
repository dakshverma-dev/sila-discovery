import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "specs/**", "docs/**", "word/**", "diagrams/**", "Design/**"] },
];

export default config;
