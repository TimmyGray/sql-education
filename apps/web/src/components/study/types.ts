/**
 * Local presentational types for the study UI.
 *
 * `theoryExamples` is `z.array(z.any())` in the contract (free-form JSON on the
 * server), so we declare the narrow shape the UI actually renders here and
 * coerce defensively at the edge (see `coerceTheoryExamples`).
 */
import type { Level } from "@sql-edu/contracts";

/** One worked example shown under the theory panel. */
export interface TheoryExample {
  title?: string;
  sql: string;
  explanation: string;
}

/** A single message in the AI tutor conversation (local-only state). */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** assistant only — rendered with a softer "won't give the answer" style. */
  refused?: boolean;
  /** marks a transient error bubble (e.g. request failed). */
  error?: boolean;
}

/** Human-facing label for a level. */
export const LEVEL_LABELS: Record<Level, string> = {
  NOVICE: "Novice",
  JUNIOR: "Junior",
  MIDDLE: "Middle",
};

/** Levels in display order — the single source for the level selector. */
export const LEVEL_ORDER: Level[] = ["NOVICE", "JUNIOR", "MIDDLE"];

/**
 * Defensively coerce the contract's `unknown[]` theoryExamples into the narrow
 * UI shape, dropping anything that doesn't look like an example.
 */
export function coerceTheoryExamples(input: unknown): TheoryExample[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item): TheoryExample[] => {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { sql?: unknown }).sql === "string" &&
      typeof (item as { explanation?: unknown }).explanation === "string"
    ) {
      const ex = item as { title?: unknown; sql: string; explanation: string };
      return [
        {
          title: typeof ex.title === "string" ? ex.title : undefined,
          sql: ex.sql,
          explanation: ex.explanation,
        },
      ];
    }
    return [];
  });
}
