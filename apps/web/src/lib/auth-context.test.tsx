import * as React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User, AuthTokens } from "@sql-edu/contracts";

// Mock the typed auth API the context calls.
jest.mock("./api/auth", () => ({
  refresh: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  startTestAccount: jest.fn(),
  createTestAccount: jest.fn(),
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
  isTestAccount: false,
  testAccountExpiresAt: null,
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

/** Surfaces every context method as a button + the resulting state. */
function MethodProbe(): React.JSX.Element {
  const auth = useAuth();
  const [out, setOut] = React.useState("idle");
  const wrap = (fn: () => Promise<unknown>) => async () => {
    try {
      const r = await fn();
      const email =
        r && typeof r === "object" && "email" in (r as object)
          ? (r as User).email
          : "void";
      setOut(`ok:${email}`);
    } catch {
      setOut("err");
    }
  };
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email : "none"}</span>
      <span data-testid="token">{auth.accessToken ?? "null"}</span>
      <span data-testid="out">{out}</span>
      <button onClick={wrap(() => auth.login("a@test.com", "pw"))}>login</button>
      <button onClick={wrap(() => auth.startTestAccount())}>startTest</button>
      <button onClick={wrap(() => auth.register("a@test.com", "pw", "pw"))}>
        register
      </button>
      <button onClick={wrap(() => auth.activate("a@test.com", "123456"))}>
        activate
      </button>
      <button onClick={wrap(() => auth.resendCode("a@test.com"))}>resend</button>
      <button onClick={wrap(() => auth.updateProfile("New Name"))}>update</button>
      <button onClick={wrap(() => auth.refreshUser())}>refreshUser</button>
      <button onClick={() => auth.setAuth(USER, "tok-set")}>setAuth</button>
      <button onClick={() => auth.clearAuth()}>clearAuth</button>
      <button onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

describe("AuthProvider methods", () => {
  const click = async (name: string) => {
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole("button", { name }));
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    tokenStore.clear();
    // Start every test logged out: the bootstrap refresh fails.
    mockApi.refresh.mockRejectedValue(new Error("no cookie"));
    render(
      <AuthProvider>
        <MethodProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none"),
    );
  });

  it("login hydrates the user and stores the token", async () => {
    mockApi.login.mockResolvedValueOnce(TOKENS);
    mockApi.getMe.mockResolvedValueOnce(USER);

    await click("login");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(screen.getByTestId("token").textContent).toBe("access-1");
    expect(mockApi.login).toHaveBeenCalledWith({
      email: "a@test.com",
      password: "pw",
    });
    expect(tokenStore.get()).toBe("access-1");
  });

  it("startTestAccount creates a temporary account and hydrates the user", async () => {
    mockApi.createTestAccount.mockResolvedValueOnce({
      ...TOKENS,
      testAccountExpiresAt: "2025-01-01T00:30:00.000Z",
    });
    mockApi.getMe.mockResolvedValueOnce(USER);

    await click("startTest");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(mockApi.createTestAccount).toHaveBeenCalledTimes(1);
  });

  it("register does not authenticate (account is PENDING)", async () => {
    mockApi.register.mockResolvedValueOnce({ message: "check your email" });

    await click("register");

    await waitFor(() =>
      expect(screen.getByTestId("out").textContent).toBe("ok:void"),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
    expect(mockApi.register).toHaveBeenCalledWith({
      email: "a@test.com",
      password: "pw",
      confirmPassword: "pw",
    });
  });

  it("activate hydrates the user", async () => {
    mockApi.activate.mockResolvedValueOnce(TOKENS);
    mockApi.getMe.mockResolvedValueOnce(USER);

    await click("activate");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(mockApi.activate).toHaveBeenCalledWith({
      email: "a@test.com",
      code: "123456",
    });
  });

  it("resendCode calls the API without changing auth", async () => {
    mockApi.resendCode.mockResolvedValueOnce({ message: "sent" });

    await click("resend");

    await waitFor(() =>
      expect(screen.getByTestId("out").textContent).toBe("ok:void"),
    );
    expect(mockApi.resendCode).toHaveBeenCalledWith({ email: "a@test.com" });
  });

  it("updateProfile updates the cached user", async () => {
    mockApi.updateProfile.mockResolvedValueOnce({
      ...USER,
      displayName: "New Name",
    });

    await click("update");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(mockApi.updateProfile).toHaveBeenCalledWith({
      displayName: "New Name",
    });
  });

  it("refreshUser re-reads the current user", async () => {
    mockApi.getMe.mockResolvedValueOnce(USER);

    await click("refreshUser");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
  });

  it("setAuth then clearAuth toggle the in-memory state and token store", async () => {
    await click("setAuth");
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    expect(screen.getByTestId("token").textContent).toBe("tok-set");
    expect(tokenStore.get()).toBe("tok-set");

    await click("clearAuth");
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none"),
    );
    expect(tokenStore.get()).toBeNull();
  });

  it("logout clears auth even when the server call fails", async () => {
    await click("setAuth");
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("ada@example.com"),
    );
    mockApi.logout.mockRejectedValueOnce(new Error("network"));

    await click("logout");

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("none"),
    );
    expect(tokenStore.get()).toBeNull();
  });
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    function Bare(): null {
      useAuth();
      return null;
    }
    // Silence the expected React error boundary logging.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });
});
