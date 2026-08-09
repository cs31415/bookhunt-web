/**
 * Where the bookhunt API lives, from the BFF's point of view.
 *
 * Read lazily, never captured in a module-level const: ESM hoists every import
 * above the `dotenv.config()` call in index.ts, so anything evaluated at module
 * scope reads process.env before the .env file has been loaded.
 */
export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3001/api';
}
