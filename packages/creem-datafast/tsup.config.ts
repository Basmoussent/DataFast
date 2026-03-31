import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      browser: "src/browser.ts",
      "adapters/express": "src/adapters/express.ts",
      "adapters/nextjs": "src/adapters/nextjs.ts",
    },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    external: ["creem", "express"],
  },
]);
