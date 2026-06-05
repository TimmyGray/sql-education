import * as fs from "fs";
import { Client } from "pg";
import { request, type FullConfig } from "@playwright/test";
import {
  API_ORIGIN,
  DATABASE_URL,
  MAILHOG_ORIGIN,
  REFERENCE_FILE,
  WEB_ORIGIN,
} from "../playwright.config";

/**
 * Readiness gate: poll a URL until it answers (any non-zero HTTP status), so
 * the suite never starts before the API, web app, and MailHog are up.
 */
async function waitForUrl(
  url: string,
  label: string,
  { timeoutMs = 60_000, intervalMs = 1000 } = {},
): Promise<void> {
  const api = await request.newContext();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      try {
        const res = await api.get(url, { timeout: 5000 });
        if (res.status() > 0) {
          // eslint-disable-next-line no-console
          console.log(`[global-setup] ${label} ready (${res.status()}) @ ${url}`);
          return;
        }
      } catch {
        // not up yet — retry
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `[global-setup] ${label} not ready within ${timeoutMs}ms @ ${url}`,
    );
  } finally {
    await api.dispose();
  }
}

/**
 * Global setup: connect to the APP DB and export the seeded reference answers
 * for NOVICE block 1 so the journey spec can submit a genuinely-correct query
 * (and reveal/inspect others). This is test infrastructure reading the seed —
 * the application itself never exposes a reference answer except via the
 * explicit reveal endpoint (which marks the task SKIPPED).
 *
 * The result is written to {@link REFERENCE_FILE} (gitignored) as:
 *   {
 *     block1: { id, title, order,
 *               tasks: [{ order, referenceQuery }, ...] }
 *   }
 */

export interface ReferenceTask {
  order: number;
  referenceQuery: string;
}

export interface ReferenceData {
  block1: {
    id: string;
    title: string;
    order: number;
    tasks: ReferenceTask[];
  };
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // (0) Gate on the live stack being reachable before doing anything else.
  await waitForUrl(`${API_ORIGIN}/health`, "API");
  await waitForUrl(WEB_ORIGIN, "Web");
  await waitForUrl(`${MAILHOG_ORIGIN}/api/v2/messages`, "MailHog");

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const block = await client.query<{
      id: string;
      title: string;
      order: number;
    }>(
      `SELECT id, title, "order"
         FROM "Block"
        WHERE level = 'NOVICE' AND "order" = 1
        LIMIT 1`,
    );

    if (block.rowCount === 0) {
      throw new Error(
        "global-setup: NOVICE block 1 not found — is the app DB seeded?",
      );
    }
    const b1 = block.rows[0];

    const tasks = await client.query<{
      order: number;
      referenceQuery: string;
    }>(
      `SELECT "order", "referenceQuery"
         FROM "Task"
        WHERE "blockId" = $1
        ORDER BY "order" ASC`,
      [b1.id],
    );

    if (tasks.rowCount === 0) {
      throw new Error("global-setup: NOVICE block 1 has no tasks.");
    }

    const data: ReferenceData = {
      block1: {
        id: b1.id,
        title: b1.title,
        order: b1.order,
        tasks: tasks.rows.map((t) => ({
          order: t.order,
          referenceQuery: t.referenceQuery,
        })),
      },
    };

    fs.writeFileSync(REFERENCE_FILE, JSON.stringify(data, null, 2), "utf8");
    // eslint-disable-next-line no-console
    console.log(
      `[global-setup] wrote ${data.block1.tasks.length} reference answers for ` +
        `NOVICE block 1 ("${data.block1.title}") -> ${REFERENCE_FILE}`,
    );
  } finally {
    await client.end();
  }
}

export default globalSetup;
