import { defineConfig } from "vite";

// Relative base on purpose: the same `dist/` is served from four different
// URL prefixes (/glow/, /glow/claude/, /glow/openai/, /glow/grok/), so the
// build must not bake an absolute path. See docs/DEPLOY.md.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
