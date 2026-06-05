import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubmitResult, TaskPublic } from "@sql-edu/contracts";

jest.mock("@/lib/api/study", () => ({
  submitAnswer: jest.fn(),
  reveal: jest.fn(),
}));

import { submitAnswer, reveal } from "@/lib/api/study";
import { TaskCard } from "./TaskCard";

const submitMock = submitAnswer as jest.MockedFunction<typeof submitAnswer>;
const revealMock = reveal as jest.MockedFunction<typeof reveal>;

const TASK: TaskPublic = {
  id: "t1",
  order: 1,
  prompt: "Select all rows from employees.",
  hint: "Use SELECT * FROM employees.",
  status: "NOT_STARTED",
  attempts: 0,
  datasetSchema: [
    {
      tableName: "employees",
      columns: [
        { name: "id", type: "INT" },
        { name: "first_name", type: "VARCHAR(50)" },
      ],
    },
  ],
};

/** A plain textarea standing in for the CodeMirror editor in tests. */
function textareaSlot({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}): React.ReactNode {
  return (
    <textarea
      aria-label="SQL editor"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function renderTask(overrides?: Partial<TaskPublic>): {
  onStatusChange: jest.Mock;
} {
  const onStatusChange = jest.fn();
  render(
    <TaskCard
      task={{ ...TASK, ...overrides }}
      index={0}
      onStatusChange={onStatusChange}
      editorSlot={textareaSlot}
    />,
  );
  return { onStatusChange };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TaskCard — submit", () => {
  it("shows a success state and marks COMPLETED on a correct answer", async () => {
    const result: SubmitResult = {
      correct: true,
      status: "COMPLETED",
      message: "Nicely done.",
      columns: ["id", "first_name"],
      rows: [
        [1, "Alice"],
        [2, "Bob"],
      ],
    };
    submitMock.mockResolvedValue(result);
    const { onStatusChange } = renderTask();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL editor"), "SELECT * FROM employees;");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Correct!")).toBeInTheDocument();
    expect(screen.getByText("Nicely done.")).toBeInTheDocument();
    // User's returned rows render.
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenCalledWith("t1", "COMPLETED");
    expect(submitMock).toHaveBeenCalledWith("t1", "SELECT * FROM employees;");
  });

  it("renders the user's rows on WRONG_RESULT", async () => {
    const result: SubmitResult = {
      correct: false,
      status: "NOT_STARTED",
      message: "That isn't the expected output.",
      errorType: "WRONG_RESULT",
      columns: ["id"],
      rows: [[42]],
    };
    submitMock.mockResolvedValue(result);
    renderTask();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL editor"), "SELECT id FROM employees;");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(
      screen.getByText("That isn't the expected output."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your query returned:/i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows the message on a FORBIDDEN error", async () => {
    const result: SubmitResult = {
      correct: false,
      status: "NOT_STARTED",
      message: "Only SELECT statements are allowed.",
      errorType: "FORBIDDEN",
    };
    submitMock.mockResolvedValue(result);
    renderTask();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL editor"), "DROP TABLE employees;");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
    expect(
      screen.getByText("Only SELECT statements are allowed."),
    ).toBeInTheDocument();
    // No result table for non-wrong-result errors.
    expect(screen.queryByText(/Your query returned:/i)).not.toBeInTheDocument();
  });

  it("disables submit until SQL is entered", async () => {
    renderTask();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });
});

describe("TaskCard — hint", () => {
  it("toggles the hint text", async () => {
    renderTask();
    const user = userEvent.setup();

    expect(
      screen.queryByText("Use SELECT * FROM employees."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show hint/i }));
    expect(
      await screen.findByText("Use SELECT * FROM employees."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hide hint/i }));
    await waitFor(() =>
      expect(
        screen.queryByText("Use SELECT * FROM employees."),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("TaskCard — reveal", () => {
  it("confirming reveals the reference query and marks SKIPPED", async () => {
    revealMock.mockResolvedValue({
      referenceQuery: "SELECT * FROM employees;",
      status: "SKIPPED",
    });
    const { onStatusChange } = renderTask();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reveal answer/i }));

    // Confirm dialog appears.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Reveal the answer\?/i)).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: /reveal answer/i }),
    );

    expect(await screen.findByText("Reference answer")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Reference answer"),
    ).toHaveTextContent("SELECT * FROM employees;");
    expect(revealMock).toHaveBeenCalledWith("t1");
    expect(onStatusChange).toHaveBeenCalledWith("t1", "SKIPPED");
  });

  it("does not reveal when the confirm dialog is cancelled", async () => {
    renderTask();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reveal answer/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(revealMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Reference answer")).not.toBeInTheDocument();
  });
});
