import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * Playwright config for the SQL-Education end-to-end suite.
 *
 * Targets the locally-running web app (:3000) which talks to the API (:3001).
 * The infra (postgres/redis/rabbitmq/mailhog) and both app servers must be up
 * before the suite runs — see the root `pnpm e2e` script which gates on
 * readiness. A `globalSetup` reads the seeded reference answers straight from
 * the APP DB (test infra reading the DB — NOT the app leaking it) so the
 * journey can submit a genuinely-correct query.
 *
 * Projects:
 *  - chromium  : desktop Chrome, runs the full user journey.
 *  - mobile    : Pixel-5 (393x851) viewport, runs the responsive checks.
 */

export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";
export const MAILHOG_ORIGIN =
  process.env.MAILHOG_ORIGIN ?? "http://localhost:8025";
export const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://sql_edu:sql_edu_pw@localhost:5432/sql_edu";

/** Where globalSetup stashes the reference answers for the specs to read. */
export const REFERENCE_FILE = path.join(__dirname, ".e2e-references.json");

export default defineConfig({
  testDir: "./tests",
  // Run files in parallel, but keep each spec's steps sequential.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Journeys hit a live stack (register -> email -> activate -> grade); give
  // each test generous headroom so a slow grade/email poll never flakes.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],

  globalSetup: require.resolve("./tests/global-setup"),

  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Mobile responsive checks. Pixel 5 is 393x851; we assert no horizontal
      // overflow and that the hamburger nav works at a phone width.
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
});
