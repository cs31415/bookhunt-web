import { createLogger, defineConfig } from 'vite'
import type { IncomingMessage } from 'node:http'
import react from '@vitejs/plugin-react'

const BFF_TARGET = 'http://localhost:3002'

/**
 * Vite's own proxy failure output, replaced below with something actionable.
 * Matching on the message it logs is the only hook it offers — the handler that
 * emits this is bound after `configure` runs, so it cannot be unsubscribed.
 */
const VITE_PROXY_ERROR = 'http proxy error'

/**
 * Suppresses Vite's `http proxy error` line and its bare ECONNREFUSED stack,
 * which never mention the BFF, the port, or how to start it. Everything else
 * logs normally.
 */
function quietProxyErrors() {
  const logger = createLogger('warn')
  const { error } = logger
  logger.error = (msg, options) => {
    if (msg.includes(VITE_PROXY_ERROR)) return
    error(msg, options)
  }
  return logger
}

/**
 * Explains a failed /bff call in terms of the thing that is actually wrong.
 *
 * Starting only Vite is an easy mistake, because `vite` used to be the whole
 * dev server and silently is not any more — a refused connection here is nearly
 * always that, not a bug worth a stack trace.
 *
 * ECONNREFUSED arrives as a Node AggregateError whose `message` is empty, so
 * the code has to be read off the error rather than matched in its text.
 */
function explainProxyFailures(proxy: {
  on: (event: 'error', listener: (err: Error, req: IncomingMessage) => void) => void
}): void {
  proxy.on('error', (err, req) => {
    const target = `${req.method ?? 'GET'} ${req.url}`

    if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      console.error(
        `\n  \x1b[31m✗ The BFF is not running on ${BFF_TARGET}\x1b[0m` +
          `\n    ${target} failed, and every /bff call will 502 until it is up.` +
          `\n    Run \x1b[1mnpm run dev\x1b[0m to start both — plain \x1b[1mvite\x1b[0m runs the app alone.\n`,
      )
      return
    }

    console.error(`\n  \x1b[31m✗ /bff proxy error on ${target}\x1b[0m\n    ${err.stack ?? err}\n`)
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Terminal: keep errors and warnings, drop the dependency-optimization and
  // page-reload chatter. Browser-side "[vite] connecting/connected" logs are
  // emitted by the HMR client and have no config switch — those are filtered
  // in src/main.tsx.
  logLevel: 'warn',
  customLogger: quietProxyErrors(),
  clearScreen: false,
  server: {
    proxy: {
      // The BFF (server/) runs as a second process in dev. Proxying it here
      // keeps the browser on one origin, exactly as production is: no CORS, and
      // a session cookie that needs no cross-site exemption.
      '/bff': {
        target: BFF_TARGET,
        // Sets X-Forwarded-For, so req.ip on the BFF means the same thing in
        // dev as behind a real proxy.
        xfwd: true,
        configure: explainProxyFailures,
      },
    },
  },
})
