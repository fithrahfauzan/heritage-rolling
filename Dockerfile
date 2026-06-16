# syntax=docker/dockerfile:1

# Heritage Rolling — TanStack Start (SSR) production image.
# Multi-stage: build the app, install prod-only deps, then assemble a lean runtime.
# Node 22 is required: Vite 7 needs Node ^20.19 || >=22.12.

# ---- Stage 1: build the client + SSR server bundles ----
FROM node:22-alpine AS build
WORKDIR /app
# Install full deps (incl. dev) using the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci
# Build outputs dist/client (static assets) + dist/server/server.js (fetch handler).
COPY . .
RUN npm run build

# ---- Stage 2: resolve production-only dependencies ----
# The SSR bundle imports @tanstack/*, h3-v2, seroval, react at runtime,
# and `srvx` serves it — all of which live in `dependencies`.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: minimal runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Prod node_modules + build artifacts + the files read at runtime.
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./
COPY config ./config

# `data/` holds the persisted distribution state (data/distribution.json).
# Mount a volume here in production so state survives restarts.
RUN mkdir -p data && chown -R node:node /app
USER node

EXPOSE 3000
# `npm start` -> srvx serves SSR + dist/client static assets; honors $PORT.
CMD ["npm", "start"]
