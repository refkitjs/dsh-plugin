import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The automatic JSX runtime (tsconfig.client.json's react-jsx) for tests/*.tsx as well:
  // vite reads `jsx` from the tsconfig project that includes a file, and none includes tests/.
  esbuild: { jsx: 'automatic' },
  test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], environment: 'node' },
})
