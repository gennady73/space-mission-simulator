import { defineConfig } from 'vitest/config';

// base './' so the build works on GitHub Pages under /space-mission-simulator/ and offline (REQ-010).
// Vitest runs unit tests only; *.e2e.spec.ts files belong to Playwright (npm run test:e2e).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/**/*.e2e.spec.ts', 'node_modules/**'],
  },
});
