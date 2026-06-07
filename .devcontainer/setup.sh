#!/usr/bin/env bash
set -euo pipefail

# Windows volume mounts are owned by root; mark the workspace safe so git works
# under the node user (VS Code does this automatically, but explicit is safer).
git config --global --add safe.directory /workspaces/sql-education
git config core.autocrlf input

# Create root .env with docker-internal service hostnames if it doesn't exist.
if [ ! -f /workspaces/sql-education/.env ]; then
  sed \
    -e 's|@localhost:5432/sql_edu|@postgres:5432/sql_edu|g' \
    -e 's|@localhost:5433/sandbox|@sandbox-postgres:5432/sandbox|g' \
    -e 's|redis://localhost:6379|redis://redis:6379|g' \
    -e 's|amqp://guest:guest@localhost:5672|amqp://guest:guest@rabbitmq:5672|g' \
    -e 's|SMTP_HOST=localhost|SMTP_HOST=mailhog|g' \
    /workspaces/sql-education/.env.example \
    > /workspaces/sql-education/.env
  echo "Created .env from .env.example (docker-internal URLs)"
fi

# Create apps/api/.env for Prisma CLI if it doesn't exist.
if [ ! -f /workspaces/sql-education/apps/api/.env ]; then
  sed \
    -e 's|@localhost:5432/sql_edu|@postgres:5432/sql_edu|g' \
    /workspaces/sql-education/apps/api/.env.example \
    > /workspaces/sql-education/apps/api/.env
  echo "Created apps/api/.env from apps/api/.env.example (docker-internal URLs)"
fi

# corepack enable must write to /usr/local/bin which requires root.
sudo corepack enable
corepack prepare --activate

# Install workspace dependencies.
cd /workspaces/sql-education
pnpm install
