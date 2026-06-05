# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Multi-stage build for the Next.js web app (standalone output). Build context
# is the REPO ROOT so the @sql-edu/contracts workspace package is available.
# ---------------------------------------------------------------------------

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/
# `dangerouslyAllowAllBuilds` lets first-party deps (sharp, …) run their build
# scripts. pnpm 11 blocks dependency build scripts by default and treats them as
# a fatal error in CI; these are trusted packages in our own image.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile=false --config.dangerouslyAllowAllBuilds=true

# ---- build ----
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# See api/Dockerfile: stop pnpm 11 auto-reinstalling before running scripts.
ENV npm_config_verify_deps_before_run=false
COPY . .
RUN pnpm --config.verifyDepsBeforeRun=false --filter @sql-edu/contracts build \
    && pnpm --config.verifyDepsBeforeRun=false --filter web build

# ---- runner: Next.js standalone server ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# standalone server entrypoint lives at apps/web/server.js inside the bundle
CMD ["node", "apps/web/server.js"]
