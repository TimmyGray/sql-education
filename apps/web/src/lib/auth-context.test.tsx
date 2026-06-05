import * as React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User, AuthTokens } from "@sql-edu/contracts";

// Mock the typed auth API the context calls.
jest.mock("./api/auth", () => ({
  refresh: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  activate: jest.fn(),
  resendCode: jest.fn(),
  logout: jest.fn(),
  updateProfile: jest.fn(),
}));

import * as authApi from "./api/auth";
import { AuthProvider, useAuth } from "./auth-context";
import { tokenStore } from "./api-client";

const mockApi = authApi as jest.Mocked<typeof authApi>;

const TOKENS: AuthTokens = {
  accessToken: "access-1",
  tokenType: "Bearer",
  expiresIn: 900,
};
const USER: User = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
};

/** Tiny probe that surfaces context state into the DOM for assertions. */
function Probe(): React.JSX.Element {
  const { user, isBootstrapping, logout } = useAuth();
  return (
    <div>
      <span data-testid="bootstrapping">{String(isBootstrapping)}</span>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe("AuthProvider bootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenStore.clear();
  });

  it("hydrates the user from a silent refresh on mount", async () => {
    mockApi.refresh.mockResolvedValueOnce(TOKENS);
    mockApi.getMe.mockResolvedValueOnce(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Starts bootstrapping.
    expect(screen.getByTestId("bootstrapping").textContent).toBe("true");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(screen.getByTestId("bootstrapping").textContent).toBe("false");
    expect(tokenStore.get()).toBe("access-1");
  });

  it("stays logged out when the refresh cookie is invalid", async () => {
    mockApi.refresh.mockRejectedValueOnce(new Error("401"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("bootstrapping").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

  it("logout clears the user and token", async () => {
    mockApi.refresh.mockResolvedValueOnce(TOKENS);
    mockApi.getMe.mockResolvedValueOnce(USER);
    mockApi.logout.mockResolvedValueOnce({ message: "ok" });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "logout" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none"),
    );
    expect(tokenStore.get()).toBeNull();
    expect(mockApi.logout).toHaveBeenCalledTimes(1);
  });
});
