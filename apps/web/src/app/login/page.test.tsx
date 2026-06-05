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

const loginMock = jest.fn();
const baseAuth = {
  user: null,
  accessToken: null,
  isBootstrapping: false,
  login: loginMock,
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
});
