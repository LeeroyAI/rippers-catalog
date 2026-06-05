import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Domain logic is pure (no DOM); run in node. The `@/` alias mirrors tsconfig
// so test files can import the same `@/src/...` paths the app uses.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
});
