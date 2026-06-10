import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { User } from "@sql-edu/contracts";

// --- Mocks -----------------------------------------------------------------
const pushMock = jest.fn();
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const updateProfileMock = jest.fn();
const logoutMock = jest.fn();

const activeUser: User = {
  id: "u1",
  email: "ada@example.com",
  displayName: "Ada",
  status: "ACTIVE",
  createdAt: "2025-01-15T00:00:00.000Z",
  isTestAccount: false,
  testAccountExpiresAt: null,
};

const auth = {
  user: activeUser as User | null,
  accessToken: "tok",
  isBootstrapping: false,
  updateProfile: updateProfileMock,
  logout: logoutMock,
};
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => auth,
}));

import AccountPage from "./page";

describe("AccountPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    updateProfileMock.mockReset();
    logoutMock.mockReset();
    auth.user = activeUser;
  });

  it("renders the profile details", () => {
    renderWithProviders(<AccountPage />);
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it("updates the display name and shows a success message", async () => {
    updateProfileMock.mockResolvedValueOnce({
      ...activeUser,
      displayName: "Ada Lovelace",
    });
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);

    const input = screen.getByLabelText(/display name/i);
    await user.clear(input);
    await user.type(input, "Ada Lovelace");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith("Ada Lovelace"),
    );
    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
  });

  it("logs out and redirects to /login", async () => {
    logoutMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<AccountPage />);

    await user.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
