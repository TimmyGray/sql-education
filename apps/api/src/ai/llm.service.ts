import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  AiStructuredOutputSchema,
  type AiStructuredOutput,
} from "@sql-edu/contracts";
import { SAFE_REFUSAL } from "./refusals";

/** Default model when AI_MODEL is not configured. */
const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** Parse a loose boolean env value ("1"/"true"/"yes" → true). */
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Deterministic reply for the offline fake provider (AI_FAKE). Intentionally a
 * concept-level nudge with NO SQL statement targeting any task table, so it is
 * pedagogically useful, never leaks a solution, and passes the answer post-
 * filter untouched. `refused: false` so the UI renders it as a normal answer.
 */
const FAKE_REPLY: AiStructuredOutput = {
  reply:
    "Great question! Start from the task's goal and the schema: decide which " +
    "columns you need and which table holds them, then build the statement " +
    "one clause at a time — pick your columns, choose the table to read, and " +
    "add filters or ordering only if the task asks for them. Revisit the " +
    "block's theory for the exact syntax, then write it yourself and submit " +
    "to check your result.",
  refused: false,
};

/**
 * ---------------------------------------------------------------------------
 * LlmService — the ONLY network boundary in the AI module.
 * ---------------------------------------------------------------------------
 *
 * Wraps the OpenAI SDK pointed at OpenRouter (or OpenAI directly). It exposes:
 *  - {@link isConfigured}: whether any provider key is present, so the service
 *    layer can degrade gracefully without throwing when AI creds are absent.
 *  - {@link complete}: send a system+user prompt, request JSON structured
 *    output, and return a VALIDATED {@link AiStructuredOutput}. On any failure
 *    (network error, non-JSON, schema mismatch) it returns a safe refusal
 *    rather than throwing, so a flaky model can never break the endpoint.
 *
 * Tests mock THIS class (its `complete`) — there is no real network in tests.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey?: string;
  private readonly baseURL?: string;
  private readonly model: string;
  private client?: OpenAI;
  /**
   * Offline deterministic provider for local e2e / demos. When AI_FAKE is
   * truthy and no real provider key is set, the service reports configured and
   * `complete()` returns a fixed, helpful, NON-solution reply WITHOUT any
   * network call. The answer-leakage guards are unaffected: the reference query
   * is still never in the model context and {@link sanitizeReply} still runs in
   * AiService. This lets the AI tutor flow be exercised without real creds.
   */
  private readonly fake: boolean;

  constructor(private readonly config: ConfigService) {
    const openRouterKey = this.config.get<string>("OPENROUTER_API_KEY");
    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    this.fake = parseBool(this.config.get<string>("AI_FAKE"));

    if (openRouterKey) {
      // Prefer OpenRouter: use its key + base URL (default to the public host).
      this.apiKey = openRouterKey;
      this.baseURL =
        this.config.get<string>("OPENROUTER_BASE_URL") ??
        "https://openrouter.ai/api/v1";
    } else if (openAiKey) {
      // Fall back to OpenAI directly (its SDK default base URL).
      this.apiKey = openAiKey;
      this.baseURL = this.config.get<string>("OPENROUTER_BASE_URL") ?? undefined;
    }

    this.model = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;
  }

  /**
   * True when at least one provider key is configured, OR the offline fake
   * provider is enabled (AI_FAKE). Either way AiService may proceed to call
   * {@link complete} and account a question against the quota.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey) || this.fake;
  }

  /** Lazily construct the OpenAI client (only when a key exists). */
  private getClient(): OpenAI | undefined {
    if (!this.isConfigured()) {
      return undefined;
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    }
    return this.client;
  }

  /**
   * Send a single tutoring turn and return a validated structured output.
   * Never throws: any error path resolves to a safe refusal.
   */
  async complete(
    system: string,
    user: string,
  ): Promise<AiStructuredOutput> {
    // Offline fake provider: deterministic, non-solution coaching. No network.
    if (this.fake && !this.apiKey) {
      return { ...FAKE_REPLY };
    }

    const client = this.getClient();
    if (!client) {
      // Defensive: callers check isConfigured() first, but never call the LLM
      // without creds.
      return { ...SAFE_REFUSAL };
    }

    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) {
        this.logger.warn("LLM returned empty content; refusing safely.");
        return { ...SAFE_REFUSAL };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        this.logger.warn("LLM returned non-JSON content; refusing safely.");
        return { ...SAFE_REFUSAL };
      }

      const result = AiStructuredOutputSchema.safeParse(parsedJson);
      if (!result.success) {
        this.logger.warn(
          "LLM JSON did not match AiStructuredOutputSchema; refusing safely.",
        );
        return { ...SAFE_REFUSAL };
      }

      return result.data;
    } catch (err) {
      this.logger.error(
        `LLM request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...SAFE_REFUSAL };
    }
  }
}
