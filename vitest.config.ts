import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Each file gets a fresh fake IndexedDB (see setup.ts).
    isolate: true,
  },
})
