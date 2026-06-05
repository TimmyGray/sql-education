import { z } from "zod";

/**
 * ---------------------------------------------------------------------------
 * AI tutor contracts.
 * ---------------------------------------------------------------------------
 */

/** User -> AI tutor question. The block/task scope comes from the route. */
export const AskSchema = z.object({
  message: z.string().min(1).max(1000),
});
export type Ask = z.infer<typeof AskSchema>;

/**
 * Response returned to the client after an AI ask.
 *
 * This is also the structured-output shape conceptually returned to the
 * client: the server takes the LLM's `AiStructuredOutput` and appends
 * `questionsRemaining` (the user's remaining per-block quota).
 *
 * `refused` is true when the model declined to hand over the solution / went
 * off-topic.
 */
export const AiReplySchema = z.object({
  reply: z.string(),
  refused: z.boolean(),
  questionsRemaining: z.number().int(),
});
export type AiReply = z.infer<typeof AiReplySchema>;

/**
 * Structured output the LLM MUST return (before the server augments it with
 * quota info). `reply` is capped to keep responses tight.
 */
export const AiStructuredOutputSchema = z.object({
  reply: z.string().max(1500),
  refused: z.boolean(),
});
export type AiStructuredOutput = z.infer<typeof AiStructuredOutputSchema>;
