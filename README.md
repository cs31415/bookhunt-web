# BookHunt Web

Frontend for BookHunt — a personal book explorer app. Talks to the [bookhunt](https://github.com/cs31415/bookhunt) API.

## Tech Stack

- **Framework**: Vite + React + TypeScript
- **Routing**: React Router
- **Linting/formatting**: ESLint + Prettier

## Project Structure

```
src/
  api/          Typed HTTP client, one function per file, grouped by resource
  normalize/    snake_case (backend) -> camelCase mappers, one per resource
  shared/       Code used by 2+ features: components/, hooks/, theme/, layout/
  features/     One folder per page, holding that page's own components/hooks
  routes/       Router shell and route guards
```

Default to colocating new code inside the relevant `features/<name>/` folder. Only promote something to `shared/` once a second feature needs it.

## Setup

```bash
cp .env.example .env
# VITE_API_URL defaults to http://localhost:3001/api, matching the bookhunt API's default port
npm install
npm run dev
```

Requires the [bookhunt](https://github.com/cs31415/bookhunt) API running locally (`npm run dev` in that repo, port 3001).

## Scripts

```bash
npm run dev       # start the Vite dev server
npm run build     # type-check and build for production
npm run lint      # run ESLint
npm run format    # run Prettier
```
