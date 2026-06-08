import { ConfigService } from "@nestjs/config";
import { LlmService } from "./llm.service";

/**
 * LlmService tests — OpenAI SDK fully mocked (no real network).
 * Covers: configuration detection, client construction, completeStream
 * (happy path, retry-then-succeed, retry exhaustion, mid-stream failure).
 */

const createMock = jest.fn();
const ctorMock = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(opts: unknown) { ctorMock(opts); }
  },
}));

jest.useFakeTimers();

const MAX_RETRIES = 5;

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

async function flushTimers() {
  await jest.runAllTimersAsync();
}

beforeEach(() => {
  createMock.mockReset();
  ctorMock.mockReset();
  jest.clearAllTimers();
});

afterAll(() => { jest.useRealTimers(); });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe("LlmService — configuration", () => {
  it("isConfigured() is false without any key, and completeStream yields nothing", async () => {
    const svc = new LlmService(configWith({}));
    expect(svc.isConfigured()).toBe(false);

    const chunks: string[] = [];
    for await (const c of svc.completeStream("s", "u")) chunks.push(c);

    expect(chunks).toHaveLength(0);
    expect(ctorMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("prefers OpenRouter key + base URL when both are set", async () => {
    const svc = new LlmService(configWith({
      OPENROUTER_API_KEY: "or-key",
      OPENAI_API_KEY: "oa-key",
      AI_MODEL: "openai/gpt-4o-mini",
    }));
    expect(svc.isConfigured()).toBe(true);

    async function* oneChunk() { yield { choices: [{ delta: { content: "hi" } }] }; }
    createMock.mockReturnValue(oneChunk());

    const chunks: string[] = [];
    for await (const c of svc.completeStream("sys", "user")) chunks.push(c);

    expect(ctorMock).toHaveBeenCalledWith({ apiKey: "or-key", baseURL: "https://openrouter.ai/api/v1" });
    expect(createMock.mock.calls[0][0].model).toBe("openai/gpt-4o-mini");
    expect(createMock.mock.calls[0][0].stream).toBe(true);
    expect(createMock.mock.calls[0][0].messages[0]).toEqual({ role: "system", content: "sys" });
    expect(createMock.mock.calls[0][0].messages[1]).toEqual({ role: "user", content: "user" });
  });

  it("falls back to OpenAI key when no OpenRouter key", async () => {
    const svc = new LlmService(configWith({ OPENAI_API_KEY: "oa-key" }));
    async function* one() { yield { choices: [{ delta: { content: "ok" } }] }; }
    createMock.mockReturnValue(one());
    for await (const _ of svc.completeStream("s", "u")) { /* consume */ }
    expect(ctorMock).toHaveBeenCalledWith({ apiKey: "oa-key", baseURL: undefined });
  });

  it("uses default model when AI_MODEL is unset", async () => {
    const svc = new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
    async function* one() { yield { choices: [{ delta: { content: "ok" } }] }; }
    createMock.mockReturnValue(one());
    for await (const _ of svc.completeStream("s", "u")) { /* consume */ }
    expect(createMock.mock.calls[0][0].model).toBe("moonshotai/kimi-k2.6:free");
  });

  it("reuses a single client instance across calls", async () => {
    const svc = new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
    async function* one() { yield { choices: [{ delta: { content: "a" } }] }; }
    createMock.mockReturnValue(one());
    for await (const _ of svc.completeStream("s", "u")) { /* consume */ }
    async function* two() { yield { choices: [{ delta: { content: "b" } }] }; }
    createMock.mockReturnValue(two());
    for await (const _ of svc.completeStream("s", "u")) { /* consume */ }
    expect(ctorMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("fake mode yields canned reply without calling the SDK", async () => {
    const svc = new LlmService(configWith({ AI_FAKE: "true" }));
    expect(svc.isConfigured()).toBe(true);
    const chunks: string[] = [];
    for await (const c of svc.completeStream("s", "u")) chunks.push(c);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("").length).toBeGreaterThan(10);
    expect(createMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// completeStream — happy path
// ---------------------------------------------------------------------------

describe("LlmService.completeStream — happy path", () => {
  function svc() {
    return new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
  }

  it("yields chunks from the stream", async () => {
    async function* stream() {
      yield { choices: [{ delta: { content: "Hello" } }] };
      yield { choices: [{ delta: { content: " world" } }] };
      yield { choices: [{ delta: { content: null } }] };
    }
    createMock.mockReturnValue(stream());

    const chunks: string[] = [];
    for await (const c of svc().completeStream("sys", "user")) chunks.push(c);

    expect(chunks).toEqual(["Hello", " world"]);
  });
});

// ---------------------------------------------------------------------------
// completeStream — retry behavior
// ---------------------------------------------------------------------------

describe("LlmService.completeStream — retry", () => {
  function svc() {
    return new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
  }

  it("retries on error then yields chunks when retry succeeds", async () => {
    async function* failOnce() { throw new Error("429"); }
    async function* success() { yield { choices: [{ delta: { content: "ok" } }] }; }
    createMock
      .mockReturnValueOnce(failOnce())
      .mockReturnValue(success());

    const resultPromise = (async () => {
      const chunks: string[] = [];
      for await (const c of svc().completeStream("s", "u")) chunks.push(c);
      return chunks;
    })();

    await flushTimers();
    expect(await resultPromise).toEqual(["ok"]);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries (no tokens yielded)", async () => {
    async function* fail() { throw new Error("429 always"); }
    createMock.mockImplementation(() => fail());

    const resultPromise = (async () => {
      for await (const _ of svc().completeStream("s", "u")) { /* consume */ }
    })();
    resultPromise.catch(() => {}); // suppress unhandled-rejection during timer flush

    await flushTimers();
    await expect(resultPromise).rejects.toThrow("429 always");
    expect(createMock).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it("throws immediately on mid-stream error — no retry after partial output", async () => {
    async function* midFail() {
      yield { choices: [{ delta: { content: "partial" } }] };
      throw new Error("mid-stream drop");
    }
    createMock.mockReturnValue(midFail());

    const chunks: string[] = [];
    await expect(async () => {
      for await (const c of svc().completeStream("s", "u")) chunks.push(c);
    }).rejects.toThrow("mid-stream drop");

    expect(chunks).toEqual(["partial"]);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
