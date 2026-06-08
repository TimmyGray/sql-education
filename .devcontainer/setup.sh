#!/usr/bin/env bash
set -euo pipefail

# Windows volume mounts are owned by root; mark the workspace safe so git works
# under the node user (VS Code does this automatically, but explicit is safer).
git config --global --add safe.directory /workspaces/sql-education
git config core.autocrlf input

# Create root .env with docker-internal service hostnames if it doesn't exist.
# This is the single .env file — NestJS reads it directly (envFilePath: '../../.env')
# and Prisma scripts are prefixed with `dotenv -e ../../.env --` so both tools share
# one source of truth. process.env overrides (REDIS_URL, RABBITMQ_URL) in
# docker-compose.extend.yml then win for container-internal hostnames at runtime.
if [ ! -f /workspaces/sql-education/.env ]; then
  sed \
    -e 's|@localhost:5432/sql_edu|@postgres:5432/sql_edu|g' \
    -e 's|redis://localhost:6379|redis://redis:6379|g' \
    -e 's|amqp://guest:guest@localhost:5672|amqp://guest:guest@rabbitmq:5672|g' \
    -e 's|SMTP_HOST=localhost|SMTP_HOST=mailhog|g' \
    /workspaces/sql-education/.env.example \
    > /workspaces/sql-education/.env
  echo "Created .env from .env.example (docker-internal URLs)"
fi

# corepack enable must write to /usr/local/bin which requires root.
sudo corepack enable
corepack prepare --activate

# Named Docker volumes are provisioned owned by root; hand them to the node user
# before pnpm tries to write into them (no-op once ownership is already correct).
sudo chown node:node \
  /workspaces/sql-education/node_modules \
  /workspaces/sql-education/apps/api/node_modules \
  /workspaces/sql-education/apps/web/node_modules \
  /workspaces/sql-education/packages/contracts/node_modules \
  /workspaces/sql-education/e2e/node_modules

# Install workspace dependencies.
cd /workspaces/sql-education
pnpm install

# Generate the Prisma client so TypeScript can see the DB models.

# pnpm prisma:generate

# Apply committed migrations (prisma migrate deploy). DATABASE_URL comes from
# root .env (via dotenv-cli prefix in the db:migrate script).

# pnpm db:migrate

# Bake curriculum content, then seed it. db:validate runs each referenceQuery
# against embedded SQLite and writes <level>/baked.json; db:seed upserts from
# those baked files (idempotent, safe to re-run on every rebuild).

# pnpm db:validate
# pnpm db:seed
