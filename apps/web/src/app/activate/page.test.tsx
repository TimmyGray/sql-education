import * as React from "react";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { ApiError } from "@/lib/api-client";

// --- Mocks -----------------------------------------------------------------
const pushMock = jest.fn();
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams("email=ada@example.com"),
}));

const activateMock = jest.fn();
const resendCodeMock = jest.fn();
const baseAuth = {
  user: null,
  accessToken: null,
  isBootstrapping: false,
  activate: activateMock,
  resendCode: resendCodeMock,
};
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => baseAuth,
}));

import ActivatePage from "./page";

function typeCode(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
): Promise<void> {
  return (async () => {
    const cells = screen.getAllByRole("textbox");
    // The six segmented inputs are the code cells (no email field shown here).
    for (let i = 0; i < code.length; i += 1) {
      await user.type(cells[i], code[i]);
    }
  })();
}

describe("ActivatePage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    activateMock.mockReset();
    resendCodeMock.mockReset();
  });

  it("resend starts a 60s cooldown that disables the button and counts down", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    resendCodeMock.mockResolvedValueOnce(undefined);

    renderWithProviders(<ActivatePage />);

    const resendBtn = screen.getByRole("button", { name: /resend code/i });
    await user.click(resendBtn);

    await waitFor(() => expect(resendCodeMock).toHaveBeenCalledWith("ada@example.com"));

    // Button is now disabled and shows a countdown.
    const cooldownBtn = await screen.findByRole("button", {
      name: /resend in 60s/i,
    });
    expect(cooldownBtn).toBeDisabled();

    // Advance 3 seconds: the countdown ticks down.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(
      screen.getByRole("button", { name: /resend in 57s/i }),
    ).toBeDisabled();

    jest.useRealTimers();
  });

  it("activates and navigates to /dashboard when the full code is entered", async () => {
    activateMock.mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
      displayName: null,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<ActivatePage />);

    await typeCode(user, "ABC123");

    // onComplete fires on the 6th char; activate is called with the code.
    await waitFor(() =>
      expect(activateMock).toHaveBeenCalledWith("ada@example.com", "ABC123"),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows an error and does not navigate on a wrong code (400)", async () => {
    activateMock.mockRejectedValueOnce(new ApiError(400, "Invalid code"));
    const user = userEvent.setup();
    renderWithProviders(<ActivatePage />);

    await typeCode(user, "WRONG1");

    expect(
      await screen.findByText(/incorrect or has expired/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
