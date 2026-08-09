import type { Router } from 'express';
import { FORWARD_ROUTES } from './forward-manifest.js';
import { forwardToApi } from './forward-to-api.js';
import { requireSession } from '../session/require-session.js';

/**
 * Turns the manifest into routes, in order. Anything absent from the manifest
 * is never registered, so it 404s here and the API never hears about it.
 */
export function registerForwardRoutes(router: Router): void {
  for (const route of FORWARD_ROUTES) {
    const handlers =
      route.auth === 'required'
        ? [requireSession, forwardToApi(route.auth)]
        : [forwardToApi(route.auth)];
    router[route.method](route.path, ...handlers);
  }
}
