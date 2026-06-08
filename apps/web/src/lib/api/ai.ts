import {
  AiStreamEventSchema,
  type AiStreamDone,
  type AiStreamEvent,
} from "@sql-edu/contracts";
import { API_BASE_URL, tokenStore } from "@/lib/api-client";

/**
 * POST /ai/blocks/:blockId/ask/stream
 *
 * Streams tokens from the AI tutor via SSE. Calls `onToken` for each arriving
 * chunk, `onDone` with the final metadata, and `onError` on failure.
 * Pass an AbortSignal to cancel (e.g. on drawer close).
 */
export function askAiStream(
  blockId: string,
  message: string,
  onToken: (text: string) => void,
  onDone: (done: AiStreamDone) => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
): void {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${API_BASE_URL}/ai/blocks/${encodeURIComponent(blockId)}/ask/stream`;

  fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ message }),
    signal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`Stream request failed: ${res.status} ${res.statusText}`);
      }

      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const event = AiStreamEventSchema.parse(
            JSON.parse(line.slice(6)),
          ) as AiStreamEvent;
          if (event.type === "token") onToken(event.text);
          else if (event.type === "done") onDone(event);
          else if (event.type === "error") onError(new Error(event.message));
        } catch {
          // ignore malformed lines
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line.trimEnd());
      }
      if (buffer.trim()) processLine(buffer.trimEnd());
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") return;
      onError(err instanceof Error ? err : new Error(String(err)));
    });
}
