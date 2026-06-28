import { defineConfig } from 'vitest/config'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default defineConfig({
  test: {
    reporter: process.env.CI ? 'verbose' : 'default',
    globals: true,
    isolate: true,
    environment: 'node',
    execArgv: [
      `--localstorage-file=${join(
        tmpdir(),
        '1000fetches-vitest-localstorage.json'
      )}`,
    ],
    setupFiles: ['./src/testing/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        'src/testing/**',
        'src/**/*.test.ts',
        'src/**/*.typecheck.ts',
        'src/types.ts',
        'src/utils/index.ts',
      ],
      all: true,
      include: ['src/**/*.ts'],
      clean: true,
      cleanOnRerun: true,
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
        'src/request/request.ts': {
          branches: 75,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'src/request/**.ts': {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
})
