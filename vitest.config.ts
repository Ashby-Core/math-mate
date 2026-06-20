import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the `@/*` -> project root alias from tsconfig.json so test imports
// resolve the same way as the app. Pure-TS unit tests run in a node environment.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
