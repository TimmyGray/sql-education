import * as React from "react";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { User } from "@sql-edu/contracts";

// next/link renders an anchor; preserve forwarded props (aria-current, onClick).
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: unknown;
  }) =>
    React.createElement(
      "a",
      { href: typeof href === "string" ? href : "#", ...rest },
      children,
    ),
}));

const replaceMock = jest.fn();
const pathState = { value: "/dashboard" };
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathState.value,
}));

const logoutMock = jest.fn().mockResolvedValue(undefined);
const authState: {
  value: { user: User | null; logout: () => Promise<void> };
} = { value: { user: null, logout: logoutMock } };
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => authState.value,
}));

import { AppNav } from "./AppNav";

const ACTIVE_USER: User = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada Lovelace",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
  isTestAccount: false,
  testAccountExpiresAt: null,
};

beforeEach(() => {
  replaceMock.mockReset();
  logoutMock.mockClear();
  pathState.value = "/dashboard";
  authState.value = { user: ACTIVE_USER, logout: logoutMock };
});

describe("AppNav", () => {
  it("renders the section links", () => {
    renderWithProviders(<AppNav />);
    expect(
      screen.getByRole("link", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toBeInTheDocument();
  });

  it("marks the exactly-matching link as the current page", () => {
    pathState.value = "/dashboard";
    renderWithProviders(<AppNav />);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
      "Dashboard",
    );
  });

  it("marks a parent section active for nested routes (startsWith)", () => {
    pathState.value = "/account/settings";
    renderWithProviders(<AppNav />);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
      "Account",
    );
  });

  it("shows two-letter initials from a multi-word display name", () => {
    renderWithProviders(<AppNav />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("falls back to email initials when there is no display name", () => {
    authState.value = {
      user: { ...ACTIVE_USER, displayName: null },
      logout: logoutMock,
    };
    renderWithProviders(<AppNav />);
    expect(screen.getByText("AD")).toBeInTheDocument();
  });

  it("opens the account menu on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppNav />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(
      await screen.findByRole("menuitem", { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it("opens the mobile navigation drawer", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppNav />);

    // The drawer (and its visible "Log out" entry) is unmounted until opened.
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /open navigation menu/i }),
    );

    expect(await screen.findByText("Log out")).toBeInTheDocument();
  });

  it("logs out and redirects to /login from the mobile logout button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppNav />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Log out" }));
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });

  it("renders without a user (empty avatar, no crash)", () => {
    authState.value = { user: null, logout: logoutMock };
    renderWithProviders(<AppNav />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
});
