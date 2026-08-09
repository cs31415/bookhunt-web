import express, { Router } from 'express';
import type { Express } from 'express';
import cookieParser from 'cookie-parser';
import { requestLogger } from './lib/request-logger.js';
import { requireSameOrigin } from './lib/require-same-origin.js';
import { registerForwardRoutes } from './routes/register-forward-routes.js';
import { loginRoute } from './routes/login-route.js';
import { verifyEmailRoute } from './routes/verify-email-route.js';
import { logoutRoute } from './routes/logout-route.js';
import { serveStaticSpa } from './serve-static-spa.js';

/** Where the browser reaches the BFF. Vite proxies this path in dev. */
export const BFF_MOUNT_PATH = '/bff';

/**
 * The BookHunt BFF: the only origin the browser talks to.
 *
 * Exported separately from index.ts so tests can drive the app without binding
 * a port or loading a .env file.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  // Makes req.ip the reader's address rather than the load balancer's, which is
  // what gets forwarded to the API as X-Forwarded-For. A hop count, never
  // `true` — see the matching note in the API's index.ts (LOS-221).
  const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS);
  if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    app.set('trust proxy', trustedProxyHops);
  }

  app.use(cookieParser());
  // Bodies stay as bytes. A proxy that parsed and re-serialised JSON would be
  // silently rewriting what the API receives, and would have to guess whether
  // an empty body means `{}` or nothing at all.
  app.use(express.raw({ type: '*/*', limit: '2mb' }));

  const bff = Router();

  // First, so it records what the guards reject as well as what they let
  // through — those rejections never reach the API and would otherwise leave no
  // trace anywhere.
  bff.use(requestLogger);

  // Ahead of the guard on purpose: a liveness probe is not a browser and has
  // no session to abuse.
  bff.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  bff.use(requireSameOrigin);

  // The three that touch the cookie, before the manifest registers the rest.
  bff.post('/auth/login', loginRoute);
  bff.post('/auth/verify-email', verifyEmailRoute);
  bff.post('/auth/logout', logoutRoute);
  registerForwardRoutes(bff);

  app.use(BFF_MOUNT_PATH, bff);

  if (process.env.NODE_ENV === 'production') serveStaticSpa(app);

  return app;
}
