import { Injectable, NotFoundException } from "@nestjs/common";
import type { AiReply } from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "./llm.service";
import {
  buildUserPrompt,
  collectTaskTableNames,
  SYSTEM_PROMPT,
  type SafeBlock,
} from "./prompt";
import { sanitizeReply } from "./sanitize";
import {
  AI_QUESTIONS_PER_BLOCK,
  NOT_CONFIGURED_REPLY,
  QUOTA_EXCEEDED_REPLY,
} from "./refusals";

/**
 * SECURITY-CRITICAL Prisma selection for building the model context.
 *
 * This `select` EXPLICITLY OMITS `Task.referenceQuery` and
 * `Task.expectedResultJson`. Because we never read those columns, the reference
 * answer is structurally absent from everything we build for the LLM — answer
 * leakage is impossible even under a successful jailbreak of the prompt.
 *
 * It is exported so a test can assert the exact shape passed to Prisma.
 */
export const SAFE_BLOCK_SELECT = {
  title: true,
  theoryMarkdown: true,
  tasks: {
    orderBy: { order: "asc" as const },
    select: {
      order: true,
      prompt: true,
      hint: true,
      // referenceQuery / expectedResultJson intentionally OMITTED.
      dataset: { select: { schemaJson: true } },
    },
  },
} as const;

/**
 * ---------------------------------------------------------------------------
 * AiService — orchestrates a single tutoring turn for a block.
 * ---------------------------------------------------------------------------
 *
 * Flow:
 *   1. If no AI provider is configured → graceful refusal (no throw).
 *   2. Read durable per-(user,block) quota; if used >= 10 → short-circuit
 *      WITHOUT calling the LLM, returning a refusal + remaining 0.
 *   3. Load the block + tasks via {@link SAFE_BLOCK_SELECT} (no reference
 *      answer). 404 if the block doesn't exist.
 *   4. Build the prompt from ONLY the safe context, call LlmService.complete
 *      (already Zod-validated to AiStructuredOutput, never throws).
 *   5. Run the {@link sanitizeReply} post-filter to redact any answer-shaped
 *      query against the task's real tables.
 *   6. Atomically increment the quota (cap at 10) and return the AiReply with
 *      questionsRemaining.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async ask(
    userId: string,
    blockId: string,
    message: string,
  ): Promise<AiReply> {
    // (1) No creds → graceful, non-throwing refusal. The LLM is never built.
    if (!this.llm.isConfigured()) {
      const used = await this.readQuestionsUsed(userId, blockId);
      return {
        reply: NOT_CONFIGURED_REPLY,
        refused: true,
        questionsRemaining: this.remaining(used),
      };
    }

    // (2) Durable quota check BEFORE any model call.
    const used = await this.readQuestionsUsed(userId, blockId);
    if (used >= AI_QUESTIONS_PER_BLOCK) {
      return {
        reply: QUOTA_EXCEEDED_REPLY,
        refused: true,
        questionsRemaining: 0,
      };
    }

    // (3) Load block + tasks WITHOUT the reference answer.
    const block = (await this.prisma.block.findUnique({
      where: { id: blockId },
      select: SAFE_BLOCK_SELECT,
    })) as SafeBlock | null;

    if (!block) {
      throw new NotFoundException("Block not found");
    }

    // (4) Build prompt from safe context only, then call the model.
    const system = SYSTEM_PROMPT;
    const userPrompt = buildUserPrompt(block, message);
    const modelOut = await this.llm.complete(system, userPrompt);

    // (5) Post-filter: redact any answer-shaped query against real task tables.
    const tableNames = collectTaskTableNames(block);
    const safe = sanitizeReply(modelOut.reply, tableNames, modelOut.refused);

    // (6) Atomically increment usage (cap at 10) and report remaining.
    const newUsed = await this.incrementUsage(userId, blockId, used);

    return {
      reply: safe.reply,
      refused: safe.refused,
      questionsRemaining: this.remaining(newUsed),
    };
  }

  // -------------------------------------------------------------------------
  // Quota helpers — read/increment the durable UserBlockAiUsage row. The read
  // path mirrors Agent B's ContentService (compound key `userId_blockId`,
  // `questionsUsed` default 0); THIS service owns the increment.
  // -------------------------------------------------------------------------

  /** Current questionsUsed for (user, block); 0 when no row exists. */
  private async readQuestionsUsed(
    userId: string,
    blockId: string,
  ): Promise<number> {
    const row = await this.prisma.userBlockAiUsage.findUnique({
      where: { userId_blockId: { userId, blockId } },
      select: { questionsUsed: true },
    });
    return row?.questionsUsed ?? 0;
  }

  /**
   * Atomically bump questionsUsed: create the row at 1, or increment an
   * existing row. The result is clamped to the cap so an out-of-band overshoot
   * never reports negative remaining. Returns the new used count (clamped).
   */
  private async incrementUsage(
    userId: string,
    blockId: string,
    currentUsed: number,
  ): Promise<number> {
    const row = await this.prisma.userBlockAiUsage.upsert({
      where: { userId_blockId: { userId, blockId } },
      create: { userId, blockId, questionsUsed: 1 },
      update: { questionsUsed: { increment: 1 } },
      select: { questionsUsed: true },
    });
    const persisted = row?.questionsUsed ?? currentUsed + 1;
    return Math.min(persisted, AI_QUESTIONS_PER_BLOCK);
  }

  /** Remaining questions, clamped to [0, cap]. */
  private remaining(used: number): number {
    return Math.max(0, AI_QUESTIONS_PER_BLOCK - used);
  }
}
