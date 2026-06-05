# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Multi-stage build for the Nest.js API. Build context is the REPO ROOT so the
# @sql-edu/contracts workspace package is available.
# ---------------------------------------------------------------------------

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---- deps: install all workspace deps with a warm pnpm store ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
# `dangerouslyAllowAllBuilds` lets first-party deps (prisma, argon2, …) run their
# build scripts. pnpm 11 blocks dependency build scripts by default and treats
# them as a fatal error in CI; these are trusted packages in our own image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile=false --config.dangerouslyAllowAllBuilds=true

# ---- build: compile contracts + api ----
# `verifyDepsBeforeRun=false` stops pnpm 11 from auto-reinstalling before each
# script: the deps layer already installed what we build, but after `COPY . .`
# the full workspace is present and pnpm's pre-run check would otherwise trigger
# a fresh (network-bound, no-TTY) install and fail.
FROM deps AS build
ENV npm_config_verify_deps_before_run=false
COPY . .
RUN pnpm --config.verifyDepsBeforeRun=false --filter @sql-edu/contracts build \
    && pnpm --config.verifyDepsBeforeRun=false --filter api exec prisma generate \
    && pnpm --config.verifyDepsBeforeRun=false --filter api build

# ---- runner: production image ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
