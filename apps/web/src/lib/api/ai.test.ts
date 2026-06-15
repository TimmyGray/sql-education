import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from "node:util";

// jsdom doesn't provide TextEncoder/TextDecoder; the SSE reader needs them.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = NodeTextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder =
    NodeTextDecoder as unknown as typeof globalThis.TextDecoder;
}

import type { AiStreamDone } from "@sql-edu/contracts";
import { askAiStream } from "./ai";
import { API_BASE_URL, tokenStore } from "@/lib/api-client";

const DONE: AiStreamDone = {
  type: "done",
  refused: false,
  questionsRemaining: 3,
  reply: "Hello",
};

const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

/** A reader that yields the given string chunks, then signals done. */
function streamOf(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const enc = new globalThis.TextEncoder();
  let i = 0;
  return {
    read: async () => {
      if (i < chunks.length) {
        const value = enc.encode(chunks[i]);
        i += 1;
        return { done: false, value };
      }
      return { done: true, value: undefined };
    },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

function streamResponse(chunks: string[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: { getReader: () => streamOf(chunks) },
  } as unknown as Response;
}

interface Result {
  tokens: string[];
  done?: AiStreamDone;
  error?: Error;
  fetchMock: jest.Mock;
}

/** Runs askAiStream and resolves once onDone or onError fires. */
function run(
  fetchMock: jest.Mock,
  opts: { token?: string; blockId?: string } = {},
): Promise<Result> {
  global.fetch = fetchMock;
  if (opts.token) tokenStore.set(opts.token);
  else tokenStore.clear();

  const tokens: string[] = [];
  return new Promise<Result>((resolve) => {
    askAiStream(
      opts.blockId ?? "blk 1",
      "hi",
      (t) => tokens.push(t),
      (done) => resolve({ tokens, done, fetchMock }),
      (error) => resolve({ tokens, error, fetchMock }),
    );
  });
}

afterEach(() => {
  tokenStore.clear();
  jest.clearAllMocks();
});

describe("askAiStream", () => {
  it("streams token events then the done event", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      streamResponse([
        sse({ type: "token", text: "He" }),
        sse({ type: "token", text: "llo" }),
        sse(DONE),
      ]),
    );

    const { tokens, done, error } = await run(fetchMock);

    expect(tokens).toEqual(["He", "llo"]);
    expect(done).toEqual(DONE);
    expect(error).toBeUndefined();
  });

  it("targets the encoded block URL and omits Authorization when no token is set", async () => {
    const fetchMock = jest.fn().mockResolvedValue(streamResponse([sse(DONE)]));

    const { fetchMock: fm } = await run(fetchMock);

    const [url, init] = fm.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/ai/blocks/blk%201/ask/stream`);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("attaches the Bearer token when one is in the store", async () => {
    const fetchMock = jest.fn().mockResolvedValue(streamResponse([sse(DONE)]));

    const { fetchMock: fm } = await run(fetchMock, { token: "tok-123" });

    const init = fm.mock.calls[0][1];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-123",
    );
  });

  it("surfaces an error event via onError", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      streamResponse([sse({ type: "error", message: "LLM exploded" })]),
    );

    const { error } = await run(fetchMock);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("LLM exploded");
  });

  it("ignores malformed and non-data lines but still processes valid events", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      streamResponse([
        ": keep-alive\n\n",
        "data: {not valid json\n\n",
        sse({ type: "token", text: "ok" }),
        sse(DONE),
      ]),
    );

    const { tokens, done, error } = await run(fetchMock);

    expect(tokens).toEqual(["ok"]);
    expect(done).toEqual(DONE);
    expect(error).toBeUndefined();
  });

  it("reassembles a line split across chunks and flushes a trailing buffer with no newline", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      streamResponse([
        'data: {"type":"to',
        'ken","text":"Hi"}\n\n',
        // final done event arrives WITHOUT a trailing newline -> leftover buffer
        `data: ${JSON.stringify(DONE)}`,
      ]),
    );

    const { tokens, done } = await run(fetchMock);

    expect(tokens).toEqual(["Hi"]);
    expect(done).toEqual(DONE);
  });

  it("calls onError when the response is not ok", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      body: { getReader: () => streamOf([]) },
    } as unknown as Response);

    const { error } = await run(fetchMock);

    expect(error?.message).toMatch(/Stream request failed: 500/);
  });

  it("calls onError when the response has no body", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body: null,
    } as unknown as Response);

    const { error } = await run(fetchMock);

    expect(error).toBeInstanceOf(Error);
  });

  it("swallows an AbortError without surfacing it", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    global.fetch = jest.fn().mockRejectedValue(abort);
    tokenStore.clear();
    const onError = jest.fn();
    const onDone = jest.fn();

    askAiStream("b1", "hi", jest.fn(), onDone, onError);
    await new Promise((r) => setTimeout(r, 10));

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("wraps a non-Error rejection in an Error for onError", async () => {
    global.fetch = jest.fn().mockRejectedValue("plain string failure");
    tokenStore.clear();

    const { error } = await run(global.fetch as jest.Mock);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("plain string failure");
  });
});
