import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { ApiError } from "@/lib/api-client";

// --- Mocks -----------------------------------------------------------------
const pushMock = jest.fn();
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const registerMock = jest.fn();
const startTestAccountMock = jest.fn();
const baseAuth = {
  user: null,
  accessToken: null,
  isBootstrapping: false,
  register: registerMock,
  startTestAccount: startTestAccountMock,
};
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => baseAuth,
}));

import RegisterPage from "./page";

describe("RegisterPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    registerMock.mockReset();
    startTestAccountMock.mockReset();
  });

  it("blocks submit and shows a mismatch error when passwords differ", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "different456",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("registers and navigates to /activate with the email on success", async () => {
    registerMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith(
        "ada@example.com",
        "password123",
        "password123",
      ),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "/activate?email=ada%40example.com",
    );
  });

  it("starts a test account and navigates to /dashboard on success", async () => {
    startTestAccountMock.mockResolvedValueOnce({
      id: "u-test",
      email: "test-1@test-account.sql-edu.local",
      displayName: "Test User",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      isTestAccount: true,
      testAccountExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(
      screen.getByRole("button", { name: /try a test account/i }),
    );

    await waitFor(() => expect(startTestAccountMock).toHaveBeenCalled());
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the per-IP cooldown message on a 429 TEST_ACCOUNT_RATE_LIMITED", async () => {
    startTestAccountMock.mockRejectedValueOnce(
      new ApiError(429, "Too Many Requests", {
        statusCode: 429,
        message: "Only one test account per hour is allowed from this network. Please try again later.",
        error: "TEST_ACCOUNT_RATE_LIMITED",
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(
      screen.getByRole("button", { name: /try a test account/i }),
    );

    expect(
      await screen.findByText(/only one test account per hour/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
