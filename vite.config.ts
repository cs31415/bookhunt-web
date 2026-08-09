import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Terminal: keep errors and warnings, drop the dependency-optimization and
  // page-reload chatter. Browser-side "[vite] connecting/connected" logs are
  // emitted by the HMR client and have no config switch — those are filtered
  // in src/main.tsx.
  logLevel: 'warn',
  clearScreen: false,
  server: {
    proxy: {
      // The BFF (server/) runs as a second process in dev. Proxying it here
      // keeps the browser on one origin, exactly as production is: no CORS, and
      // a session cookie that needs no cross-site exemption.
      '/bff': {
        target: 'http://localhost:3002',
        // Sets X-Forwarded-For, so req.ip on the BFF means the same thing in
        // dev as behind a real proxy.
        xfwd: true,
      },
    },
  },
})
