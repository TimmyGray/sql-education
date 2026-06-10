import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/renderWithProviders";

// --- Mocks -----------------------------------------------------------------
const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const logoutMock = jest.fn();
let mockUser: {
  isTestAccount: boolean;
  testAccountExpiresAt: string | null;
} | null = null;
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mockUser, logout: logoutMock }),
}));

import { TestAccountBanner } from "./TestAccountBanner";

describe("TestAccountBanner", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    logoutMock.mockReset();
    logoutMock.mockResolvedValue(undefined);
    mockUser = null;
  });

  it("renders nothing when there is no user", () => {
    const { container } = renderWithProviders(<TestAccountBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a regular (non-test) account", () => {
    mockUser = { isTestAccount: false, testAccountExpiresAt: null };
    const { container } = renderWithProviders(<TestAccountBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a live countdown for an active test account", () => {
    mockUser = {
      isTestAccount: true,
      testAccountExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
    renderWithProviders(<TestAccountBanner />);

    expect(screen.getByText(/expires in [45]:\d{2}/)).toBeInTheDocument();
  });

  it("logs out and redirects to /login once the test account expires", async () => {
    mockUser = {
      isTestAccount: true,
      testAccountExpiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    renderWithProviders(<TestAccountBanner />);

    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/login?testAccountExpired=1"),
    );
  });
});
