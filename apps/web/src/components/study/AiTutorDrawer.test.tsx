import * as React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api/ai", () => ({
  askAiStream: jest.fn(),
}));

import { askAiStream } from "@/lib/api/ai";
import type { AiStreamDone } from "@sql-edu/contracts";
import { AiTutorDrawer } from "./AiTutorDrawer";

type AskAiStreamMock = jest.MockedFunction<typeof askAiStream>;
const mockAskAiStream = askAiStream as AskAiStreamMock;

/** Simulate the stream: call onToken for each token, then call onDone. */
function simulateStream(
  tokens: string[],
  done: AiStreamDone,
): void {
  mockAskAiStream.mockImplementationOnce(
    (_blockId, _message, onToken, onDone) => {
      // Trigger tokens synchronously (simplifies test assertions)
      for (const t of tokens) onToken(t);
      onDone(done);
    },
  );
}

/** Simulate a stream that calls onError. */
function simulateError(message: string): void {
  mockAskAiStream.mockImplementationOnce(
    (_blockId, _message, _onToken, _onDone, onError) => {
      onError(new Error(message));
    },
  );
}

function renderDrawer(initialRemaining: number): void {
  render(
    <AiTutorDrawer
      open
      onClose={() => {}}
      blockId="block-1"
      initialRemaining={initialRemaining}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AiTutorDrawer — streaming", () => {
  it("sends a message, streams tokens, then shows the done reply and decrements counter", async () => {
    simulateStream(
      ["Think ", "about ", "WHERE."],
      {
        type: "done",
        reply: "Think about WHERE.",
        refused: false,
        questionsRemaining: 4,
      },
    );
    renderDrawer(5);
    const user = userEvent.setup();

    expect(screen.getByText("5 questions left")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Message the tutor"),
      "How do I filter rows?",
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /send message/i }));
    });

    // User message shown
    expect(screen.getByText("How do I filter rows?")).toBeInTheDocument();
    // Final reply visible
    expect(
      await screen.findByText("Think about WHERE."),
    ).toBeInTheDocument();
    // Counter decremented from server's questionsRemaining
    expect(screen.getByText("4 questions left")).toBeInTheDocument();
    expect(mockAskAiStream).toHaveBeenCalledWith(
      "block-1",
      "How do I filter rows?",
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it("renders a refused reply with the won't-give-the-answer note", async () => {
    simulateStream(
      ["I can't hand you the full query, but here's a nudge…"],
      {
        type: "done",
        reply: "I can't hand you the full query, but here's a nudge…",
        refused: true,
        questionsRemaining: 2,
      },
    );
    renderDrawer(3);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "Give me the answer");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /send message/i }));
    });

    expect(
      await screen.findByText(/I can't hand you the full query/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The tutor won't give the solution/i),
    ).toBeInTheDocument();
  });

  it("shows sanitised reply from done event even if streaming text differs", async () => {
    // Simulate sanitiser: tokens contain a potential leak, done.reply is redacted
    simulateStream(
      ["SELECT * FROM orders;"],
      {
        type: "done",
        reply: "I can't give you the query that solves this task.",
        refused: true,
        questionsRemaining: 3,
      },
    );
    renderDrawer(4);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "give me the answer");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /send message/i }));
    });

    // The done.reply (redacted) must be visible, not the raw streamed token
    expect(
      await screen.findByText(/I can't give you the query/i),
    ).toBeInTheDocument();
  });

  it("disables the input and send button when no questions remain", () => {
    renderDrawer(0);

    expect(screen.getByText("0 questions left")).toBeInTheDocument();
    expect(screen.getByLabelText("Message the tutor")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    expect(
      screen.getByText(/used all your tutor questions/i),
    ).toBeInTheDocument();
  });

  it("disables further sending once the reply brings remaining to 0", async () => {
    simulateStream(
      ["Last hint."],
      {
        type: "done",
        reply: "Last hint for this block.",
        refused: false,
        questionsRemaining: 0,
      },
    );
    renderDrawer(1);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "one more?");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /send message/i }));
    });

    expect(await screen.findByText("Last hint for this block.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Message the tutor")).toBeDisabled(),
    );
  });

  it("shows an error bubble when the stream fails", async () => {
    simulateError("network down");
    renderDrawer(3);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "hello?");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /send message/i }));
    });

    expect(
      await screen.findByText(/Something went wrong: network down/i),
    ).toBeInTheDocument();
    // A failed request must not consume the quota.
    expect(screen.getByText("3 questions left")).toBeInTheDocument();
  });
});
