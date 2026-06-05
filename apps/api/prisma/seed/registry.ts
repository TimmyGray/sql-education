/**
 * Curriculum registry — the single source of truth for which levels exist and
 * where their content + baked expected-results live. Both `validate.ts` (which
 * computes/bakes expected results against the sandbox DB) and `seed.ts` (which
 * loads content + baked results into the app DB) iterate this list, so adding a
 * level is a one-line change here.
 */
import type { BlockDef, Level } from "./types";
import { noviceBlocks } from "./novice";
import { juniorBlocks } from "./junior";
import { middleBlocks } from "./middle";

export interface LevelEntry {
  level: Level;
  /** Folder under prisma/seed/ holding the blocks and baked.json. */
  dir: string;
  blocks: BlockDef[];
}

export const LEVELS: LevelEntry[] = [
  { level: "NOVICE", dir: "novice", blocks: noviceBlocks },
  { level: "JUNIOR", dir: "junior", blocks: juniorBlocks },
  { level: "MIDDLE", dir: "middle", blocks: middleBlocks },
];
