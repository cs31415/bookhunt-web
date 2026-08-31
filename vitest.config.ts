import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects, because the repo now holds two runtimes: the SPA needs a DOM,
// and the BFF needs Node globals a jsdom environment shadows.
export default defineConfig({
  test: {
    /*
     * Above the 5s default, because two environments run side by side and the
     * slow tests here are waiting on real work rather than computing anything
     * (LOS-332). A real hang still fails; it just takes longer to say so.
     */
    testTimeout: 15000,
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'web',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
