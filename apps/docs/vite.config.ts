import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { siteMetadataPlugin } from "./site-metadata-plugin";

const source = (path: string) => new URL(`../../${path}`, import.meta.url).pathname;

export default defineConfig({
  plugins: [react(), siteMetadataPlugin()],
  resolve: {
    alias: {
      "@semantic-wrap/core": source("packages/core/src/index.ts"),
      "@semantic-wrap/en": source("packages/en/src/index.ts"),
      "@semantic-wrap/ko": source("packages/ko/src/index.ts"),
      "@semantic-wrap/react": source("packages/react/src/index.tsx"),
    },
  },
  server: {
    fs: {
      allow: [source("")],
    },
  },
});
