-- ===========================================================================
-- Sandbox database bootstrap: least-privilege runner role.
--
-- This script is executed ONCE by the official postgres image when the
-- `sandbox-postgres` data volume is first initialised. The orchestrator MUST
-- mount it into that container's /docker-entrypoint-initdb.d/ (see the note at
-- the bottom of this file). It runs as the image superuser (sandbox_admin)
-- against the `sandbox` database.
--
-- SECURITY MODEL
-- --------------
-- `sandbox_runner` is the ONLY role the API uses to execute untrusted user SQL
-- (SANDBOX_RUNNER_DATABASE_URL). It is intentionally minimal:
--   * LOGIN with a known password (dev/local only — rotate in prod).
--   * NOT a superuser, NOT allowed to create roles or databases.
--   * May CONNECT to `sandbox` and CREATE schemas in it, so each grading run can
--     spin up and tear down a throwaway `grade_run` schema INSIDE a transaction
--     that is always rolled back. It owns no persistent objects.
--   * No access to any other database on the server.
-- Because grading always runs in a rolled-back transaction with a scoped
-- search_path and a statement_timeout, this role can create its scratch schema
-- yet leave nothing behind.
-- ===========================================================================

-- Create the runner role if it does not already exist (idempotent).
DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_runner') THEN
    CREATE ROLE sandbox_runner
      LOGIN
      PASSWORD 'sandbox_runner_pw'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  END IF;
END
$$;

-- Allow the runner to connect to the sandbox database and create (its own
-- throwaway) schemas there. CREATE on the database is required so each grading
-- run can `CREATE SCHEMA grade_run` (then roll it back).
GRANT CONNECT ON DATABASE sandbox TO sandbox_runner;
GRANT CREATE ON DATABASE sandbox TO sandbox_runner;

-- Let the runner use the existing public schema (read built-in functions etc.)
-- but NOT create persistent objects in it. Grading scopes search_path to its
-- own grade_run schema, so this is just baseline usability.
GRANT USAGE ON SCHEMA public TO sandbox_runner;
REVOKE CREATE ON SCHEMA public FROM sandbox_runner;

-- Belt-and-braces: make sure PUBLIC cannot create in `public` either, so the
-- runner gains nothing through the PUBLIC pseudo-role.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ===========================================================================
-- ORCHESTRATOR ACTION REQUIRED (docker-compose.yml, sandbox-postgres service):
--
--   sandbox-postgres:
--     volumes:
--       - sandbox_postgres_data:/var/lib/postgresql/data
--       # >>> ADD THIS LINE: mount the init script (read-only) so the role is
--       # created on first boot of the sandbox DB volume:
--       - ./apps/api/prisma/sandbox/init:/docker-entrypoint-initdb.d:ro
--
-- NOTE: /docker-entrypoint-initdb.d scripts run ONLY when the data directory is
-- empty (first init). If the `sandbox_postgres_data` volume already exists,
-- recreate it (`docker compose down -v` or remove just that volume) so this
-- script runs, OR create the role manually with the statements above.
--
-- The password here MUST match SANDBOX_RUNNER_DATABASE_URL in .env:
--   postgresql://sandbox_runner:sandbox_runner_pw@localhost:5433/sandbox  (host)
--   postgresql://sandbox_runner:sandbox_runner_pw@sandbox-postgres:5432/sandbox (in-docker)
-- ===========================================================================
