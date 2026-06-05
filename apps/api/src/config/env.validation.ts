import { z } from "zod";

/**
 * Environment validation for the API.
 *
 * Intentionally PERMISSIVE: required infra keys are checked, but optional
 * integrations (AI provider keys, etc.) may be missing in dev/test without
 * crashing boot. Feature waves can tighten individual keys as they wire up
 * their modules.
 *
 * Unknown keys are passed through untouched so nothing in `process.env` is
 * dropped.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Core infrastructure (have sensible dev defaults so boot never hard-fails
    // in local/test environments).
    DATABASE_URL: z
      .string()
      .default("postgresql://sql_edu:sql_edu_pw@localhost:5432/sql_edu"),

    API_PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.string().default("http://localhost:3000"),

    // Auth / JWT — dev defaults; MUST be overridden in production.
    JWT_ACCESS_SECRET: z.string().default("dev_access_secret_change_me"),
    JWT_REFRESH_SECRET: z.string().default("dev_refresh_secret_change_me"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),

    // Sandbox DBs (optional at boot; the grading/sandbox wave validates these).
    SANDBOX_ADMIN_DATABASE_URL: z.string().optional(),
    SANDBOX_RUNNER_DATABASE_URL: z.string().optional(),

    // Optional integrations — never required to boot in dev/test.
    REDIS_URL: z.string().optional(),
    RABBITMQ_URL: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    MAIL_FROM: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_BASE_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
  })
  // Allow and preserve any other env vars.
  .passthrough();

export type Env = z.infer<typeof envSchema>;

/**
 * ConfigModule `validate` hook. Returns the parsed (and defaulted) env.
 * Throws only if a present value is the wrong *type* — missing optionals are
 * fine.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
