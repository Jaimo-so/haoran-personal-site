import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build artifacts:
    ".open-next/**",
    ".wrangler/**",
    "worker-configuration.d.ts",
    // Companion tools in /ecosystem ship vendored or generated files that
    // should be linted within their own package context instead of the app root.
    "ecosystem/chrome-clipper/lib/**",
    "ecosystem/obsidian-publisher/main.js",
  ]),
]);

export default eslintConfig;
