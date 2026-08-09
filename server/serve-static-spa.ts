import path from 'node:path';
import express from 'express';
import type { Express } from 'express';
import { repoRoot } from './lib/repo-root.js';

/**
 * Serves the built SPA alongside /bff, so production is one process on one
 * origin — which is what lets the session cookie be SameSite and the browser
 * make no cross-origin request at all.
 *
 * In dev this is not used: Vite serves the app and proxies /bff here.
 */
export function serveStaticSpa(app: Express): void {
  const dist = path.join(repoRoot(), 'dist');
  app.use(express.static(dist));

  // Client-side routing: every unmatched GET is a deep link into the SPA, not a
  // missing file. Registered after /bff, so an unknown /bff path still 404s as
  // JSON rather than quietly returning index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    res.sendFile(path.join(dist, 'index.html'));
  });
}
