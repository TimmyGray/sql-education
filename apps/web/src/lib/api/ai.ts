/**
 * Typed API wrapper for the AI tutor.
 *
 * Thin helper over the foundation's `request<T>()` (token + refresh handled
 * there). The tutor is hard-capped per block (10 questions); the response's
 * `questionsRemaining` is the source of truth the UI counts down from, and
 * `refused` is true when the model declined to hand over the solution.
 */
import {
  AiReplySchema,
  type AiReply,
} from "@sql-edu/contracts";
import { request } from "@/lib/api-client";

/** POST /ai/blocks/:blockId/ask → ask the tutor a question about this block. */
export async function askAi(
  blockId: string,
  message: string,
): Promise<AiReply> {
  const data = await request<AiReply>(
    `/ai/blocks/${encodeURIComponent(blockId)}/ask`,
    { method: "POST", json: { message } },
  );
  return AiReplySchema.parse(data);
}
