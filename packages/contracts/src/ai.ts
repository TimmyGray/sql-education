import { z } from "zod";

/** User → AI tutor question. The block/task scope comes from the route. */
export const AskSchema = z.object({
  message: z.string().min(1).max(1000),
});
export type Ask = z.infer<typeof AskSchema>;

// ---------------------------------------------------------------------------
// SSE streaming events for POST /ai/blocks/:blockId/ask/stream
// ---------------------------------------------------------------------------

export const AiStreamTokenSchema = z.object({
  type: z.literal("token"),
  text: z.string(),
});

/**
 * Final event. `reply` is the sanitised authoritative text — client should
 * replace accumulated tokens with this if it differs (sanitiser may redact).
 */
export const AiStreamDoneSchema = z.object({
  type: z.literal("done"),
  refused: z.boolean(),
  questionsRemaining: z.number().int(),
  reply: z.string(),
});

export const AiStreamErrorSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
});

export const AiStreamEventSchema = z.discriminatedUnion("type", [
  AiStreamTokenSchema,
  AiStreamDoneSchema,
  AiStreamErrorSchema,
]);

export type AiStreamToken = z.infer<typeof AiStreamTokenSchema>;
export type AiStreamDone = z.infer<typeof AiStreamDoneSchema>;
export type AiStreamError = z.infer<typeof AiStreamErrorSchema>;
export type AiStreamEvent = z.infer<typeof AiStreamEventSchema>;
