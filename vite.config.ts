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
})
