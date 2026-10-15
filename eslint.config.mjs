import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db.ts", "src/modules/*/model.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "mongoose", message: "Mongoose belongs in lib/db.ts and module model.ts files; callers use services." }],
        patterns: [{ group: ["**/scripts/**"], message: "Application code must not import seed or CLI scripts." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".auth-check/**",
    ".seed-check/**",
    ".inventory-check/**",
    ".public-check/**",
    ".automation-check/**",
  ]),
]);

export default eslintConfig;
