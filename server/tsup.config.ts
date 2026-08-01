import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Inline the workspace shared package so the built bundle is self-contained.
  noExternal: ['@hc/shared'],
  outDir: 'dist',
});
