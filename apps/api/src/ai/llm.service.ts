import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

const DEFAULT_MODEL = "moonshotai/kimi-k2.6:free";
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FAKE_REPLY_TEXT =
  "Great question! Start from the task's goal and the schema: decide which " +
  "columns you need and which table holds them, then build the statement " +
  "one clause at a time — pick your columns, choose the table to read, and " +
  "add filters or ordering only if the task asks for them. Revisit the " +
  "block's theory for the exact syntax, then write it yourself and submit " +
  "to check your result.";

/**
 * ---------------------------------------------------------------------------
 * LlmService — the ONLY network boundary in the AI module.
 * ---------------------------------------------------------------------------
 *
 * Exposes a single public method: {@link completeStream}, which streams plain-
 * text tokens from the LLM with exponential-backoff retry (max 5 retries).
 *
 * Retries apply only before the first token is yielded; a mid-stream failure
 * throws immediately (can't replay partial output).
 *
 * Throws after all retries are exhausted so callers can emit an error event
 * instead of silently producing an empty response.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey?: string;
  private readonly baseURL?: string;
  private readonly model: string;
  private client?: OpenAI;
  private readonly fake: boolean;

  constructor(private readonly config: ConfigService) {
    const openRouterKey = this.config.get<string>("OPENROUTER_API_KEY");
    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    this.fake = parseBool(this.config.get<string>("AI_FAKE"));

    if (openRouterKey) {
      this.apiKey = openRouterKey;
      this.baseURL =
        this.config.get<string>("OPENROUTER_BASE_URL") ??
        "https://openrouter.ai/api/v1";
    } else if (openAiKey) {
      this.apiKey = openAiKey;
      this.baseURL = this.config.get<string>("OPENROUTER_BASE_URL") ?? undefined;
    }

    this.model = this.config.get<string>("AI_MODEL") ?? DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || this.fake;
  }

  private getClient(): OpenAI | undefined {
    if (!this.isConfigured()) return undefined;
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    }
    return this.client;
  }

  /**
   * Stream raw text tokens from the LLM.
   *
   * Retries with exponential back-off (1 s, 2 s, 4 s, 8 s, 16 s) when no
   * tokens have been yielded yet. Throws after all retries are exhausted so
   * the caller can yield an error event to the client.
   *
   * Fake mode: yields the canned tutoring reply in a single chunk.
   */
  async *completeStream(system: string, user: string): AsyncGenerator<string> {
    if (this.fake && !this.apiKey) {
      this.logger.debug("completeStream: fake mode — returning canned reply");
      yield FAKE_REPLY_TEXT;
      return;
    }

    const client = this.getClient();
    if (!client) {
      this.logger.debug("completeStream: no client configured — yielding nothing");
      return;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let tokensYielded = 0;
      try {
        this.logger.debug(
          `completeStream: requesting model ${this.model} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
        );
        const stream = await client.chat.completions.create({
          model: this.model,
          stream: true,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            tokensYielded++;
            yield text;
          }
        }
        this.logger.debug(`completeStream: completed, ${tokensYielded} chunks`);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (tokensYielded > 0) {
          this.logger.error(
            `LLM stream interrupted after ${tokensYielded} tokens: ${msg}`,
          );
          throw err;
        }

        this.logger.warn(
          `LLM stream error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${msg}`,
        );
        if (attempt < MAX_RETRIES) {
          await this.backoff(attempt);
        } else {
          this.logger.error(`LLM stream failed after ${MAX_RETRIES + 1} attempts.`);
          throw err;
        }
      }
    }
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 16_000);
    await sleep(delay);
  }
}
