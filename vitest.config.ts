import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
