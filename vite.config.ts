import { defineConfig } from 'vite';

// base './' so the build works on GitHub Pages under /space-mission-simulator/ and offline (REQ-010).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
});
