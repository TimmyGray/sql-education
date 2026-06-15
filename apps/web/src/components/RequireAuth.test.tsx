import * as React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { User } from "@sql-edu/contracts";

const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const authState: {
  value: { user: User | null; isBootstrapping: boolean };
} = { value: { user: null, isBootstrapping: true } };
jest.mock("@/lib/auth-context", () => ({ useAuth: () => authState.value }));

import { RequireAuth, RedirectIfAuthed } from "./RequireAuth";

const ACTIVE: User = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
  isTestAccount: false,
  testAccountExpiresAt: null,
};
const PENDING: User = { ...ACTIVE, status: "PENDING" };

beforeEach(() => replaceMock.mockReset());

describe("RequireAuth", () => {
  it("shows the loader (no redirect) while bootstrapping", () => {
    authState.value = { user: null, isBootstrapping: true };
    renderWithProviders(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no user", () => {
    authState.value = { user: null, isBootstrapping: false };
    renderWithProviders(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("redirects PENDING users to /activate", () => {
    authState.value = { user: PENDING, isBootstrapping: false };
    renderWithProviders(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/activate");
  });

  it("renders children for an ACTIVE user", () => {
    authState.value = { user: ACTIVE, isBootstrapping: false };
    renderWithProviders(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("RedirectIfAuthed", () => {
  it("renders children for a logged-out visitor", () => {
    authState.value = { user: null, isBootstrapping: false };
    renderWithProviders(
      <RedirectIfAuthed>
        <div>form</div>
      </RedirectIfAuthed>,
    );
    expect(screen.getByText("form")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows the loader while bootstrapping", () => {
    authState.value = { user: null, isBootstrapping: true };
    renderWithProviders(
      <RedirectIfAuthed>
        <div>form</div>
      </RedirectIfAuthed>,
    );
    expect(screen.queryByText("form")).not.toBeInTheDocument();
  });

  it("bounces ACTIVE users to the default destination", () => {
    authState.value = { user: ACTIVE, isBootstrapping: false };
    renderWithProviders(
      <RedirectIfAuthed>
        <div>form</div>
      </RedirectIfAuthed>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("honors a custom destination", () => {
    authState.value = { user: ACTIVE, isBootstrapping: false };
    renderWithProviders(
      <RedirectIfAuthed to="/study">
        <div>form</div>
      </RedirectIfAuthed>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/study");
  });
});
