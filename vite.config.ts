/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Only the part of Node's `process` used below: the project does not depend on @types/node.
declare const process: { allowedNodeEnvironmentFlags: ReadonlySet<string> };

// Node 25+ exposes its own `localStorage` global, which shadows jsdom's one in the tests.
// The flag is only passed where it exists: older Node versions reject unknown flags.
const testExecArgv = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    poolOptions: {
      forks: { execArgv: testExecArgv },
      threads: { execArgv: testExecArgv },
    },
  },
});
