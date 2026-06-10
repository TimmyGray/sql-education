import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { ApiError } from "@/lib/api-client";

// --- Mocks -----------------------------------------------------------------
const pushMock = jest.fn();
const replaceMock = jest.fn();
// `mock`-prefixed so babel-plugin-jest-hoist allows referencing it from the
// (hoisted) jest.mock factory below.
const mockSearchParams = { value: new URLSearchParams() };
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => mockSearchParams.value,
}));

const loginMock = jest.fn();
const startTestAccountMock = jest.fn();
const baseAuth = {
  user: null,
  accessToken: null,
  isBootstrapping: false,
  login: loginMock,
  startTestAccount: startTestAccountMock,
};
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => baseAuth,
}));

import LoginPage from "./page";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  email = "ada@example.com",
  password = "password123",
) {
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.click(screen.getByRole("button", { name: /^log in$/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    loginMock.mockReset();
    startTestAccountMock.mockReset();
  });

  it("routes to /activate when the account is PENDING (403)", async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(403, "Account not activated", {
        statusCode: 403,
        message: "Account not activated",
        error: "PENDING",
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/activate?email=ada%40example.com"),
    );
  });

  it("logs in and navigates to /dashboard on success", async () => {
    loginMock.mockResolvedValueOnce({
      id: "u1",
      email: "ada@example.com",
      displayName: "Ada",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith("ada@example.com", "password123"),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows an error on bad credentials (401)", async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user);

    expect(
      await screen.findByText(/incorrect email or password/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
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
    renderWithProviders(<LoginPage />);

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
    renderWithProviders(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /try a test account/i }),
    );

    expect(
      await screen.findByText(/only one test account per hour/i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a notice when redirected after a test session expired", () => {
    jest
      .spyOn(
        jest.requireMock("next/navigation") as { useSearchParams: () => URLSearchParams },
        "useSearchParams",
      )
      .mockReturnValue(new URLSearchParams("testAccountExpired=1"));

    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/test session expired/i)).toBeInTheDocument();
  });
});
