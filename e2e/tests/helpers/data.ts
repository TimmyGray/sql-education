import * as fs from "fs";
import { REFERENCE_FILE } from "../../playwright.config";
import type { ReferenceData } from "../global-setup";

/** Password that satisfies the RegisterSchema (>= 8 chars). */
export const TEST_PASSWORD = "Password123!";

let cached: ReferenceData | null = null;

/** Reference answers exported by global-setup (read once, cached). */
export function references(): ReferenceData {
  if (cached) return cached;
  if (!fs.existsSync(REFERENCE_FILE)) {
    throw new Error(
      `Reference file missing (${REFERENCE_FILE}). Did global-setup run?`,
    );
  }
  cached = JSON.parse(fs.readFileSync(REFERENCE_FILE, "utf8")) as ReferenceData;
  return cached;
}

/** The correct query for NOVICE block 1, task `order` (1-based). */
export function block1Answer(order: number): string {
  const task = references().block1.tasks.find((t) => t.order === order);
  if (!task) {
    throw new Error(`No reference answer for block 1 task order=${order}`);
  }
  return task.referenceQuery;
}

/** A unique email per call so runs (and retries) never collide on a mailbox. */
export function uniqueEmail(prefix = "e2e"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}@test.com`;
}
