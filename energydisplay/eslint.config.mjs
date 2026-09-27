import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  // Icons are tiny static SVGs; next/image adds nothing but console warnings.
  { rules: { "@next/next/no-img-element": "off" } },
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
