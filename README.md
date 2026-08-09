# BookHunt Web

Frontend for BookHunt — a personal book explorer app. Talks to the [bookhunt](https://github.com/cs31415/bookhunt) API through its own BFF.

## Tech Stack

- **Framework**: Vite + React + TypeScript
- **Routing**: React Router
- **BFF**: Express (`server/`), the only thing the browser talks to
- **Linting/formatting**: ESLint + Prettier

## Project Structure

```
src/                The SPA
  api/              Typed HTTP client, one function per file, grouped by resource
  normalize/        snake_case (backend) -> camelCase mappers, one per resource
  shared/           Code used by 2+ features: components/, hooks/, theme/, layout/
  features/         One folder per page, holding that page's own components/hooks
  routes/           Router shell and route guards
server/             The BFF
  routes/           The forwarding manifest and the handlers that touch the cookie
  session/          httpOnly cookie <-> bookhunt JWT
  lib/              Talking to the API, relaying its answers, the CSRF guard
  config/           Env accessors (read lazily; see below)
```

Default to colocating new code inside the relevant `features/<name>/` folder. Only promote something to `shared/` once a second feature needs it.

## The BFF

The browser never calls the bookhunt API directly (LOS-119). Every request goes to `/bff`, and the BFF forwards it with the reader's JWT attached:

```
browser  --(cookie: bh_session, httpOnly)-->  BFF  --(Authorization: Bearer)-->  bookhunt API
```

Two things follow from that:

- **No credential is reachable from JavaScript.** The session is an httpOnly cookie; `src/api/auth/stored-user.ts` caches only the user's display data.
- **Only listed endpoints exist.** `server/routes/forward-manifest.ts` is the allowlist. Anything absent 404s at the BFF, so adding a page that needs a new endpoint means adding a line there.

Two guards sit in front of the cookie session. `SameSite=Lax` keeps it off cross-site requests, and `server/lib/require-same-origin.ts` requires `Sec-Fetch-Site: same-origin` on every route but `/bff/health` — a header browsers set and page script cannot forge. So an address-bar navigation to a `/bff/...` URL, and anything from another site, both get a 403.

That second guard is **not** a security boundary: `curl -H 'Sec-Fetch-Site: same-origin'` defeats it, and reaching the BFF from a terminal is exactly how you do it. What it buys is that the browser cannot be used as a deputy and that BFF URLs are not casually loadable. The defences that hold are the session, rate limiting, and not doing paid or persisting work on unauthenticated reads.

Env is read through functions, never a module-level `const` — ESM hoists imports above `dotenv.config()` in `server/index.ts`, so anything evaluated at module scope would see an unloaded environment.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev` starts two processes: Vite on 5173 and the BFF on 3002, with Vite proxying `/bff` to it so the browser stays on one origin. Also requires the [bookhunt](https://github.com/cs31415/bookhunt) API running locally (`npm run dev` in that repo, port 3001).

Set `TRUSTED_PROXY_HOPS=1` on the API so its rate limits key on the reader's address rather than the BFF's.

## Scripts

```bash
npm run dev       # Vite + the BFF together
npm run dev:web   # Vite alone
npm run dev:bff   # the BFF alone
npm run build     # type-check and build the SPA and the BFF
npm start         # run the built BFF, serving dist/ alongside /bff
npm test          # vitest, both the web (jsdom) and server (node) projects
npm run lint      # run ESLint
npm run format    # run Prettier
```
