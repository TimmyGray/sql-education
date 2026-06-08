// Re-export the post-filter redaction message so all canned tutor messages can
// be imported from one place. Its canonical definition lives with the
// sanitizer (the code that emits it).
export { REDACTED_REPLY } from "./sanitize";

/** Per-block AI question allowance (mirrors Agent B's ContentService cap). */
export const AI_QUESTIONS_PER_BLOCK = 10;

/** Shown when the per-block question quota is exhausted. */
export const QUOTA_EXCEEDED_REPLY =
  "You've reached the 10-question limit for this block.";

/** Shown when no AI provider key is configured (app still boots/runs). */
export const NOT_CONFIGURED_REPLY = "AI tutor is not configured.";
