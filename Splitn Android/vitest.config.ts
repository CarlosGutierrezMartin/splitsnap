import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // El entorno se declara por fichero con `@vitest-environment`: los tests
    // del parser corren en node, que es mucho mas rapido, y solo los de
    // componentes levantan jsdom.
    setupFiles: ['./__tests__/setup.ts'],
  },
});
