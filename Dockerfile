# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite substitutes import.meta.env at build time, so these have to be present
# *here* -- as build args, not as runtime environment. Setting them on the
# container instead silently ships a bundle built with the defaults.
ARG VITE_BFF_URL=/bff
ARG VITE_LOG_API_CALLS=false
ARG VITE_IMPORT_ROWS_PER_REQUEST=20
ENV VITE_BFF_URL=$VITE_BFF_URL \
    VITE_LOG_API_CALLS=$VITE_LOG_API_CALLS \
    VITE_IMPORT_ROWS_PER_REQUEST=$VITE_IMPORT_ROWS_PER_REQUEST

COPY . .
# tsc -b && vite build && tsc -p tsconfig.server.json -> dist/ and dist-server/
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Load-bearing: NODE_ENV=production is what makes the BFF serve the SPA at all,
# and what sets `secure` on the session cookie both when setting and clearing it.
# Without it the app answers /bff but serves no pages; with it, the deployment
# must terminate TLS or login will not stick.
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# This layout is load-bearing. server/lib/repo-root.ts resolves two levels above
# its own module, so from /app/dist-server/lib/repo-root.js it yields /app --
# which is where serve-static-spa.ts then looks for dist/. Flattening either
# directory, or nesting them differently, breaks SPA serving at runtime rather
# than at build time.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3002}/bff/health" > /dev/null || exit 1

CMD ["node", "dist-server/index.js"]
