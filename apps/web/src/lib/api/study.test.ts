import type { Dashboard, BlockContent, SubmitResult } from "@sql-edu/contracts";

jest.mock("@/lib/api-client", () => ({
  request: jest.fn(),
}));

import { request } from "@/lib/api-client";
import { getDashboard, getBlock, submitAnswer, reveal } from "./study";

const requestMock = request as jest.MockedFunction<typeof request>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("study api wrappers", () => {
  it("getDashboard GETs /content/dashboard and validates the payload", async () => {
    const dashboard: Dashboard = {
      levels: [{ level: "NOVICE", xp: 10, blocks: [] }],
    };
    requestMock.mockResolvedValue(dashboard);

    const result = await getDashboard();

    expect(requestMock).toHaveBeenCalledWith("/content/dashboard");
    expect(result).toEqual(dashboard);
  });

  it("getBlock GETs /content/blocks/:id (encoded)", async () => {
    const block: BlockContent = {
      id: "b 1",
      level: "NOVICE",
      order: 1,
      title: "Title",
      theoryMarkdown: "# hi",
      status: "IN_PROGRESS",
      tasks: [],
      aiQuestionsRemaining: 10,
    };
    requestMock.mockResolvedValue(block);

    const result = await getBlock("b 1");

    expect(requestMock).toHaveBeenCalledWith("/content/blocks/b%201");
    expect(result.id).toBe("b 1");
  });

  it("submitAnswer POSTs the sql to the submit endpoint", async () => {
    const res: SubmitResult = {
      correct: true,
      status: "COMPLETED",
      message: "ok",
    };
    requestMock.mockResolvedValue(res);

    await submitAnswer("t1", "SELECT 1;");

    expect(requestMock).toHaveBeenCalledWith("/study/tasks/t1/submit", {
      method: "POST",
      json: { sql: "SELECT 1;" },
    });
  });

  it("reveal POSTs to the reveal endpoint", async () => {
    requestMock.mockResolvedValue({
      referenceQuery: "SELECT 1;",
      status: "SKIPPED",
    });

    const res = await reveal("t1");

    expect(requestMock).toHaveBeenCalledWith("/study/tasks/t1/reveal", {
      method: "POST",
    });
    expect(res.status).toBe("SKIPPED");
  });

  it("throws if the response fails schema validation", async () => {
    // Missing required fields → Zod should reject.
    requestMock.mockResolvedValue({ levels: [{ level: "BOGUS" }] } as never);
    await expect(getDashboard()).rejects.toThrow();
  });
});
