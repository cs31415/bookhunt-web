import path from 'node:path';
import dotenv from 'dotenv';
import { createApp } from './create-app.js';
import { repoRoot } from './lib/repo-root.js';

// ESM hoists every import above this call, so nothing above may read
// process.env at module scope — each setting is fetched through a function at
// request time instead. See config/api-base-url.ts.
dotenv.config({ path: path.join(repoRoot(), '.env.local'), override: true, quiet: true });
dotenv.config({ path: path.join(repoRoot(), '.env'), quiet: true });

const port = Number(process.env.PORT) || 3002;

createApp().listen(port, () => {
  console.log(`BookHunt BFF running on port ${port}`);
});
