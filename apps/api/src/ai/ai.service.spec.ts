import { NotFoundException } from "@nestjs/common";
import { AiService, SAFE_BLOCK_SELECT } from "./ai.service";
import { LlmService } from "./llm.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOT_CONFIGURED_REPLY,
  QUOTA_EXCEEDED_REPLY,
  REDACTED_REPLY,
} from "./refusals";
import { REDACTED_REPLY as POSTFILTER_REDACTED } from "./sanitize";

/**
 * AiService tests — all I/O mocked (PrismaService + LlmService).
 *
 * Covers:
 *  - Not configured → done event, LLM never called.
 *  - Quota: exhausted → done event; successful stream increments; LLM error
 *    does NOT consume quota.
 *  - Leakage: Prisma select omits referenceQuery/expectedResultJson; messages
 *    passed to LLM contain no reference answer.
 *  - Post-filter: leaked query → redacted; conceptual reply passes through.
 *  - LLM error → error event (not empty done).
 *  - Not found → NotFoundException thrown before first yield.
 */

type AnyFn = jest.Mock;

interface MockPrisma {
  block: { findUnique: AnyFn };
  userBlockAiUsage: { findUnique: AnyFn; upsert: AnyFn };
}

const REFERENCE_QUERY = "SELECT id, total FROM orders WHERE total > 100";

const SAFE_BLOCK_ROW = {
  title: "Filtering",
  theoryMarkdown: "# WHERE clause",
  tasks: [{
    order: 1,
    prompt: "List expensive orders",
    hint: "use WHERE on total",
    dataset: {
      schemaJson: [{
        tableName: "orders",
        columns: [
          { name: "id", type: "int" },
          { name: "total", type: "numeric" },
        ],
      }],
    },
  }],
};

function makeMocks(opts?: { configured?: boolean }) {
  const prisma: MockPrisma = {
    block: { findUnique: jest.fn().mockResolvedValue(SAFE_BLOCK_ROW) },
    userBlockAiUsage: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
  };

  const llm = {
    isConfigured: jest.fn().mockReturnValue(opts?.configured ?? true),
    completeStream: jest.fn(),
  } as unknown as jest.Mocked<Pick<LlmService, "isConfigured" | "completeStream">>;

  const service = new AiService(
    prisma as unknown as PrismaService,
    llm as unknown as LlmService,
  );

  return { prisma, llm, service };
}

function upsertReturns(prisma: MockPrisma, used: number) {
  prisma.userBlockAiUsage.upsert.mockResolvedValue({ questionsUsed: used });
}

async function collect(gen: AsyncGenerator<unknown>) {
  const events = [];
  for await (const e of gen) events.push(e);
  return events;
}

// ---------------------------------------------------------------------------
// Not configured
// ---------------------------------------------------------------------------

describe("AiService — not configured", () => {
  it("yields done event and never calls the LLM", async () => {
    const { service, llm, prisma } = makeMocks({ configured: false });
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 2 });

    const events = await collect(service.askStream("u1", "b1", "hello"));

    expect(events).toEqual([{
      type: "done",
      refused: true,
      questionsRemaining: 8,
      reply: NOT_CONFIGURED_REPLY,
    }]);
    expect(llm.completeStream).not.toHaveBeenCalled();
    expect(prisma.userBlockAiUsage.upsert).not.toHaveBeenCalled();
    expect(prisma.block.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

describe("AiService — quota", () => {
  it("short-circuits when used >= 10 (LLM not called, remaining 0)", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 10 });

    const events = await collect(service.askStream("u1", "b1", "answer"));

    expect(events).toEqual([{
      type: "done",
      refused: true,
      questionsRemaining: 0,
      reply: QUOTA_EXCEEDED_REPLY,
    }]);
    expect(llm.completeStream).not.toHaveBeenCalled();
    expect(prisma.userBlockAiUsage.upsert).not.toHaveBeenCalled();
    expect(prisma.block.findUnique).not.toHaveBeenCalled();
  });

  it("first successful stream increments to 1 and reports remaining 9", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue(null);
    upsertReturns(prisma, 1);
    async function* tokens() { yield "Think "; yield "about WHERE."; }
    (llm.completeStream as jest.Mock).mockReturnValue(tokens());

    const events = await collect(service.askStream("u1", "b1", "help"));
    const done = events.find((e: any) => e.type === "done") as any;

    expect(done.questionsRemaining).toBe(9);
    const arg = prisma.userBlockAiUsage.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId_blockId: { userId: "u1", blockId: "b1" } });
    expect(arg.create).toEqual({ userId: "u1", blockId: "b1", questionsUsed: 1 });
    expect(arg.update).toEqual({ questionsUsed: { increment: 1 } });
  });

  it("caps remaining at 0 when row overshoots", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 9 });
    upsertReturns(prisma, 11);
    async function* t() { yield "ok"; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    const events = await collect(service.askStream("u1", "b1", "last"));
    const done = events.find((e: any) => e.type === "done") as any;
    expect(done.questionsRemaining).toBe(0);
  });

  it("does NOT increment quota when LLM fails (error event emitted)", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 3 });
    async function* fail() { throw new Error("429"); }
    (llm.completeStream as jest.Mock).mockReturnValue(fail());

    const events = await collect(service.askStream("u1", "b1", "help"));

    expect(events).toContainEqual(expect.objectContaining({ type: "error" }));
    expect(prisma.userBlockAiUsage.upsert).not.toHaveBeenCalled();
  });

  it("does NOT increment quota when no tokens received (empty stream)", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue({ questionsUsed: 3 });
    async function* empty() { /* yields nothing */ }
    (llm.completeStream as jest.Mock).mockReturnValue(empty());

    const events = await collect(service.askStream("u1", "b1", "help"));
    const done = events.find((e: any) => e.type === "done") as any;

    expect(prisma.userBlockAiUsage.upsert).not.toHaveBeenCalled();
    expect(done.questionsRemaining).toBe(7); // 10 - 3, unchanged
  });
});

// ---------------------------------------------------------------------------
// Leakage guardrail
// ---------------------------------------------------------------------------

describe("AiService — leakage guardrail", () => {
  it("queries Prisma with a select that omits referenceQuery/expectedResultJson", async () => {
    const { service, llm, prisma } = makeMocks();
    upsertReturns(prisma, 1);
    async function* t() { yield "ok"; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    await collect(service.askStream("u1", "b1", "help"));

    const findArg = prisma.block.findUnique.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: "b1" });
    expect(findArg.select).toBe(SAFE_BLOCK_SELECT);
    const taskSelect = findArg.select.tasks.select;
    expect(taskSelect).toHaveProperty("prompt", true);
    expect(taskSelect).toHaveProperty("hint", true);
    expect(taskSelect).not.toHaveProperty("referenceQuery");
    expect(taskSelect).not.toHaveProperty("expectedResultJson");
  });

  it("messages passed to completeStream contain NO reference answer", async () => {
    const { service, llm, prisma } = makeMocks();
    upsertReturns(prisma, 1);
    async function* t() { yield "ok"; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    await collect(service.askStream("u1", "b1", "What approach?"));

    expect(llm.completeStream).toHaveBeenCalledTimes(1);
    const [system, user] = (llm.completeStream as jest.Mock).mock.calls[0];
    const combined = `${system}\n${user}`;
    expect(combined).not.toContain(REFERENCE_QUERY);
    expect(combined).not.toContain("total > 100");
    expect(combined).not.toContain("referenceQuery");
    expect(combined).not.toContain("expectedResultJson");
    expect(user).toContain("List expensive orders");
    expect(user).toContain("What approach?");
  });
});

// ---------------------------------------------------------------------------
// Post-filter
// ---------------------------------------------------------------------------

describe("AiService — post-filter", () => {
  it("redacts a leaked query against the real task table", async () => {
    const { service, llm, prisma } = makeMocks();
    upsertReturns(prisma, 1);
    async function* t() { yield `Sure: ${REFERENCE_QUERY};`; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    const events = await collect(service.askStream("u1", "b1", "give me the query"));
    const done = events.find((e: any) => e.type === "done") as any;

    expect(done.refused).toBe(true);
    expect(done.reply).toBe(POSTFILTER_REDACTED);
    expect(done.reply).toBe(REDACTED_REPLY);
    expect(done.reply).not.toContain("SELECT");
    expect(done.questionsRemaining).toBe(9); // quota still consumed (tokens were received)
  });

  it("passes through a conceptual reply unchanged", async () => {
    const { service, llm, prisma } = makeMocks();
    upsertReturns(prisma, 1);
    async function* t() { yield "Identify the table, then filter with WHERE."; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    const events = await collect(service.askStream("u1", "b1", "hint"));
    const done = events.find((e: any) => e.type === "done") as any;

    expect(done.refused).toBe(false);
    expect(done.reply).toContain("filter with WHERE");
  });

  it("strips REFUSED: prefix and sets refused=true", async () => {
    const { service, llm, prisma } = makeMocks();
    upsertReturns(prisma, 1);
    async function* t() { yield "REFUSED: I can only help with SQL."; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    const events = await collect(service.askStream("u1", "b1", "off-topic"));
    const done = events.find((e: any) => e.type === "done") as any;

    expect(done.refused).toBe(true);
    expect(done.reply).toBe("I can only help with SQL.");
  });
});

// ---------------------------------------------------------------------------
// LLM failure
// ---------------------------------------------------------------------------

describe("AiService — LLM failure", () => {
  it("yields error event (not empty done) when completeStream throws", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue(null);
    async function* fail() { throw new Error("429 rate limited"); }
    (llm.completeStream as jest.Mock).mockReturnValue(fail());

    const events = await collect(service.askStream("u1", "b1", "help"));

    expect(events).toContainEqual(expect.objectContaining({ type: "error" }));
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: "done", reply: "" }),
    );
    expect(prisma.userBlockAiUsage.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe("AiService — not found", () => {
  it("throws NotFoundException before first yield when block doesn't exist", async () => {
    const { service, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue(null);
    prisma.block.findUnique.mockResolvedValue(null);

    const gen = service.askStream("u1", "ghost", "help");
    await expect(gen.next()).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Token events
// ---------------------------------------------------------------------------

describe("AiService.askStream — token events", () => {
  it("yields token events followed by done event", async () => {
    const { service, llm, prisma } = makeMocks();
    prisma.userBlockAiUsage.findUnique.mockResolvedValue(null);
    upsertReturns(prisma, 1);
    async function* t() { yield "Think "; yield "about WHERE."; }
    (llm.completeStream as jest.Mock).mockReturnValue(t());

    const events = await collect(service.askStream("u1", "b1", "help"));

    expect(events).toContainEqual({ type: "token", text: "Think " });
    expect(events).toContainEqual({ type: "token", text: "about WHERE." });
    const done = events.find((e: any) => e.type === "done") as any;
    expect(done.reply).toBe("Think about WHERE.");
    expect(done.questionsRemaining).toBe(9);
  });
});
