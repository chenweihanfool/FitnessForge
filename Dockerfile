# Two-stage build: compile the client (Vite) + bundle the server (esbuild)
# in a full node_modules environment, then run from the same image.
#
# The runtime stage still does a full `npm ci` (not --omit=dev), because
# `npm run db:push` (drizzle-kit) needs to be runnable via
# `docker compose exec app npm run db:push` after schema changes -- keeping
# devDependencies available avoids needing a separate migration image. This
# app is low-traffic/personal-scale, so the extra image size isn't a real
# concern; operational simplicity is worth more here. (Same pattern as
# pf-cwh's Dockerfile on this same host.)
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked into the built static assets at build time -- must match BASE_PATH
# (runtime, server-side path stripping) and PUBLIC_BASE_URL (OAuth callback
# construction) used by the app service in docker-compose.yml. See
# client/src/lib/basePath.ts.
ARG VITE_BASE_PATH=/fitness
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Set after `npm ci`, not before -- some npm versions read NODE_ENV to decide
# whether to skip devDependencies, which would leave drizzle-kit missing.
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
# Only what `npm run db:push` (drizzle-kit) needs at deploy time -- the
# running app itself only ever executes the pre-bundled dist/index.js.
COPY shared ./shared
COPY drizzle.config.ts ./

EXPOSE 5000
CMD ["node", "dist/index.js"]
