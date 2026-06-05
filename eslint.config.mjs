import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "*.tsbuildinfo",
    // Standalone Node/CommonJS scripts and the Vercel serverless function are
    // not part of the Next app, so the React/Next rule set (e.g. require()
    // imports) does not apply to them.
    "scripts/**",
    "api/**",
  ]),
  {
    rules: {
      // Treat _-prefixed identifiers as intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // This is a localStorage-first PWA: several effects deliberately sync
      // persisted/external state into React on mount or prop-change, which this
      // rule flags as a false positive. Keep it as a warning (visible, not
      // blocking) so genuine new cases still surface for review.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
