import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api/ai", () => ({
  askAi: jest.fn(),
}));

import { askAi } from "@/lib/api/ai";
import { AiTutorDrawer } from "./AiTutorDrawer";

const askAiMock = askAi as jest.MockedFunction<typeof askAi>;

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

describe("AiTutorDrawer", () => {
  it("sends a message and decrements the remaining counter from the reply", async () => {
    askAiMock.mockResolvedValue({
      reply: "Think about which clause filters rows.",
      refused: false,
      questionsRemaining: 4,
    });
    renderDrawer(5);
    const user = userEvent.setup();

    expect(screen.getByText("5 questions left")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Message the tutor"),
      "How do I filter rows?",
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    // User message + assistant reply both shown.
    expect(
      await screen.findByText("Think about which clause filters rows."),
    ).toBeInTheDocument();
    expect(screen.getByText("How do I filter rows?")).toBeInTheDocument();

    // Counter follows the server's questionsRemaining.
    expect(screen.getByText("4 questions left")).toBeInTheDocument();
    expect(askAiMock).toHaveBeenCalledWith("block-1", "How do I filter rows?");
  });

  it("renders a refused reply with the won't-give-the-answer note", async () => {
    askAiMock.mockResolvedValue({
      reply: "I can't hand you the full query, but here's a nudge…",
      refused: true,
      questionsRemaining: 2,
    });
    renderDrawer(3);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "Give me the answer");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(
      await screen.findByText(/I can't hand you the full query/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The tutor won't give the solution/i),
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
    askAiMock.mockResolvedValue({
      reply: "Last hint for this block.",
      refused: false,
      questionsRemaining: 0,
    });
    renderDrawer(1);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "one more?");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText("Last hint for this block.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Message the tutor")).toBeDisabled(),
    );
  });

  it("shows an error bubble when the request fails", async () => {
    askAiMock.mockRejectedValue(new Error("network down"));
    renderDrawer(3);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the tutor"), "hello?");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(
      await screen.findByText(/Something went wrong: network down/i),
    ).toBeInTheDocument();
    // A failed request must not consume the quota.
    expect(screen.getByText("3 questions left")).toBeInTheDocument();
  });
});
