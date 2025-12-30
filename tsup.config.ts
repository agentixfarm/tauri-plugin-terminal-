import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "guest-js/index.ts",
    "react/index": "react/src/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@tauri-apps/api", "react", "react-dom"],
  treeshake: true,
});
