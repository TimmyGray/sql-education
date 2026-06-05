import * as React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BlockContent } from "@sql-edu/contracts";
import { ApiError } from "@/lib/api-client";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api/study", () => ({
  getBlock: jest.fn(),
  submitAnswer: jest.fn(),
  reveal: jest.fn(),
}));

jest.mock("@/lib/api/ai", () => ({ askAi: jest.fn() }));

// Avoid loading CodeMirror in jsdom — render a lightweight stand-in.
jest.mock("./SqlEditor", () => ({
  SqlEditor: ({ value }: { value: string }) => (
    <textarea aria-label="SQL editor" defaultValue={value} />
  ),
}));

import { getBlock } from "@/lib/api/study";
import { StudyView } from "./StudyView";

const getBlockMock = getBlock as jest.MockedFunction<typeof getBlock>;

function renderView(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <StudyView blockId="b1" />
    </QueryClientProvider>,
  );
}

const BASE_BLOCK: BlockContent = {
  id: "b1",
  level: "NOVICE",
  order: 1,
  title: "SELECT Basics",
  theoryMarkdown: "# SELECT Basics\n\nThe `SELECT` statement retrieves data.",
  theoryExamples: [
    {
      title: "All columns",
      sql: "SELECT * FROM employees;",
      explanation: "Returns everything.",
    },
  ],
  status: "IN_PROGRESS",
  aiQuestionsRemaining: 10,
  tasks: [
    {
      id: "t1",
      order: 1,
      prompt: "Select all employees.",
      hint: "Use SELECT *.",
      status: "NOT_STARTED",
      attempts: 0,
      datasetSchema: [
        { tableName: "employees", columns: [{ name: "id", type: "INT" }] },
      ],
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("StudyView", () => {
  it("renders theory, an example, and the task editor", async () => {
    getBlockMock.mockResolvedValue(BASE_BLOCK);
    renderView();

    // Page <h1> title (appears separately from the markdown's own heading).
    expect(
      await screen.findByRole("heading", { name: "SELECT Basics", level: 1 }),
    ).toBeInTheDocument();
    // Theory markdown rendered (heading + body).
    expect(screen.getByText(/retrieves data/i)).toBeInTheDocument();
    // Worked example.
    expect(screen.getByText("All columns")).toBeInTheDocument();
    expect(screen.getByText("Returns everything.")).toBeInTheDocument();
    // Task + editor.
    expect(screen.getByText("Select all employees.")).toBeInTheDocument();
    expect(screen.getByLabelText("SQL editor")).toBeInTheDocument();
  });

  it("shows a locked message on a 403", async () => {
    getBlockMock.mockRejectedValue(new ApiError(403, "This block is locked"));
    renderView();

    expect(
      await screen.findByText(/This block is locked/i),
    ).toBeInTheDocument();
  });

  it("shows the block-complete banner when every task is already resolved", async () => {
    getBlockMock.mockResolvedValue({
      ...BASE_BLOCK,
      status: "COMPLETED",
      tasks: [
        { ...BASE_BLOCK.tasks[0], id: "t1", status: "COMPLETED" },
        {
          ...BASE_BLOCK.tasks[0],
          id: "t2",
          order: 2,
          prompt: "Second task",
          status: "SKIPPED",
        },
      ],
    });
    renderView();

    expect(await screen.findByText("Block complete!")).toBeInTheDocument();
    expect(screen.getByText(/resolved all 2 tasks/i)).toBeInTheDocument();
  });

  it("renders a retry-able error on a non-403 failure", async () => {
    getBlockMock.mockRejectedValue(new Error("kaboom"));
    renderView();

    expect(
      await screen.findByText(/Couldn't load this block/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
