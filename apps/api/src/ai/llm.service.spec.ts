import { ConfigService } from "@nestjs/config";
import { LlmService } from "./llm.service";
import { SAFE_REFUSAL } from "./refusals";

/**
 * LlmService tests — the OpenAI SDK is fully mocked (NO real network).
 * Covers: configuration detection (creds present/absent), structured-output
 * validation (malformed JSON / bad shape / empty → safe refusal, never throws),
 * and that the client is NOT constructed when no key is set.
 */

// Mock the OpenAI default export with a constructor we can introspect.
const createMock = jest.fn();
const ctorMock = jest.fn();

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: class MockOpenAI {
      chat = { completions: { create: createMock } };
      constructor(opts: unknown) {
        ctorMock(opts);
      }
    },
  };
});

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function mockReply(content: string | null) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  createMock.mockReset();
  ctorMock.mockReset();
});

describe("LlmService configuration", () => {
  it("isConfigured() is false and the client is NEVER built without any key", async () => {
    const svc = new LlmService(configWith({}));
    expect(svc.isConfigured()).toBe(false);

    // Even if complete() is (defensively) called, no client is constructed and
    // no network call happens — it returns a safe refusal.
    const out = await svc.complete("sys", "user");
    expect(out).toEqual(SAFE_REFUSAL);
    expect(ctorMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("prefers OpenRouter key + base URL when present", async () => {
    const svc = new LlmService(
      configWith({
        OPENROUTER_API_KEY: "or-key",
        OPENAI_API_KEY: "oa-key",
        AI_MODEL: "openai/gpt-4o-mini",
      }),
    );
    expect(svc.isConfigured()).toBe(true);

    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: "hi", refused: false })),
    );
    await svc.complete("sys", "user");

    expect(ctorMock).toHaveBeenCalledWith({
      apiKey: "or-key",
      baseURL: "https://openrouter.ai/api/v1",
    });
    const callArg = createMock.mock.calls[0][0];
    expect(callArg.model).toBe("openai/gpt-4o-mini");
    expect(callArg.response_format).toEqual({ type: "json_object" });
    expect(callArg.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(callArg.messages[1]).toEqual({ role: "user", content: "user" });
  });

  it("falls back to the OPENAI key when no OpenRouter key is set", async () => {
    const svc = new LlmService(configWith({ OPENAI_API_KEY: "oa-key" }));
    expect(svc.isConfigured()).toBe(true);
    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: "ok", refused: false })),
    );
    await svc.complete("s", "u");
    expect(ctorMock).toHaveBeenCalledWith({
      apiKey: "oa-key",
      baseURL: undefined,
    });
  });

  it("uses the default model when AI_MODEL is unset", async () => {
    const svc = new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: "ok", refused: false })),
    );
    await svc.complete("s", "u");
    expect(createMock.mock.calls[0][0].model).toBe("openai/gpt-4o-mini");
  });
});

describe("LlmService.complete structured-output validation", () => {
  function svc() {
    return new LlmService(configWith({ OPENROUTER_API_KEY: "or-key" }));
  }

  it("returns the validated output on well-formed JSON", async () => {
    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: "Use WHERE", refused: false })),
    );
    const out = await svc().complete("s", "u");
    expect(out).toEqual({ reply: "Use WHERE", refused: false });
  });

  it("returns a safe refusal (no throw) on NON-JSON content", async () => {
    createMock.mockResolvedValue(mockReply("not json at all"));
    const out = await svc().complete("s", "u");
    expect(out).toEqual(SAFE_REFUSAL);
  });

  it("returns a safe refusal when JSON does not match the schema", async () => {
    // Missing `refused`, wrong types.
    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: 123, somethingElse: true })),
    );
    const out = await svc().complete("s", "u");
    expect(out).toEqual(SAFE_REFUSAL);
  });

  it("returns a safe refusal on empty/null content", async () => {
    createMock.mockResolvedValue(mockReply(null));
    const out = await svc().complete("s", "u");
    expect(out).toEqual(SAFE_REFUSAL);
  });

  it("returns a safe refusal (no throw) when the SDK call rejects", async () => {
    createMock.mockRejectedValue(new Error("network down"));
    const out = await svc().complete("s", "u");
    expect(out).toEqual(SAFE_REFUSAL);
  });

  it("reuses a single client instance across calls", async () => {
    const s = svc();
    createMock.mockResolvedValue(
      mockReply(JSON.stringify({ reply: "a", refused: false })),
    );
    await s.complete("s", "u");
    await s.complete("s", "u");
    expect(ctorMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
