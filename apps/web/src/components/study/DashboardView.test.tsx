import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Dashboard } from "@sql-edu/contracts";

// --- Mocks -----------------------------------------------------------------
const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock("@/lib/api/study", () => ({
  getDashboard: jest.fn(),
}));

import { getDashboard } from "@/lib/api/study";
import { DashboardView } from "./DashboardView";

const getDashboardMock = getDashboard as jest.MockedFunction<
  typeof getDashboard
>;

function renderWithClient(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardView />
    </QueryClientProvider>,
  );
}

const DASHBOARD: Dashboard = {
  levels: [
    {
      level: "NOVICE",
      xp: 120,
      blocks: [
        {
          id: "b1",
          level: "NOVICE",
          order: 1,
          title: "SELECT Basics",
          status: "COMPLETED",
          totalTasks: 10,
          completedTasks: 10,
        },
        {
          id: "b2",
          level: "NOVICE",
          order: 2,
          title: "Filtering Rows",
          status: "IN_PROGRESS",
          totalTasks: 8,
          completedTasks: 3,
        },
        {
          id: "b3",
          level: "NOVICE",
          order: 3,
          title: "Sorting",
          status: "LOCKED",
          totalTasks: 6,
          completedTasks: 0,
        },
      ],
    },
    { level: "JUNIOR", xp: 0, blocks: [] },
    { level: "MIDDLE", xp: 0, blocks: [] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DashboardView", () => {
  it("renders block cards with their statuses and progress counts", async () => {
    getDashboardMock.mockResolvedValue(DASHBOARD);
    renderWithClient();

    expect(await screen.findByText("SELECT Basics")).toBeInTheDocument();
    expect(screen.getByText("Filtering Rows")).toBeInTheDocument();
    expect(screen.getByText("Sorting")).toBeInTheDocument();

    // Statuses surfaced via chips.
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();

    // Progress completed/total.
    expect(screen.getByText("10 / 10 tasks")).toBeInTheDocument();
    expect(screen.getByText("3 / 8 tasks")).toBeInTheDocument();

    // XP for the selected (NOVICE) level.
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("navigates to the study page when a non-locked block is clicked", async () => {
    getDashboardMock.mockResolvedValue(DASHBOARD);
    renderWithClient();
    const user = userEvent.setup();

    const card = await screen.findByTestId("block-card-b2");
    await user.click(card);

    expect(pushMock).toHaveBeenCalledWith("/study/NOVICE/b2");
  });

  it("does not make LOCKED blocks navigable", async () => {
    getDashboardMock.mockResolvedValue(DASHBOARD);
    renderWithClient();
    const user = userEvent.setup();

    // No clickable action area exists for the locked block.
    await screen.findByText("Sorting");
    expect(screen.queryByTestId("block-card-b3")).not.toBeInTheDocument();
    const lockedWrapper = screen.getByTestId("block-card-locked-b3");
    expect(lockedWrapper).toHaveAttribute("aria-disabled", "true");

    await user.click(lockedWrapper);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a coming-soon empty state for levels with no blocks", async () => {
    getDashboardMock.mockResolvedValue(DASHBOARD);
    renderWithClient();
    const user = userEvent.setup();

    await screen.findByText("SELECT Basics");
    await user.click(screen.getByRole("tab", { name: "Junior" }));

    expect(
      await screen.findByText(/Junior content is coming soon/i),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    getDashboardMock.mockRejectedValue(new Error("boom"));
    renderWithClient();

    expect(
      await screen.findByText(/Couldn't load your dashboard/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("scopes status chips to their own card", async () => {
    getDashboardMock.mockResolvedValue(DASHBOARD);
    renderWithClient();

    const completedCard = await screen.findByTestId("block-card-b1");
    expect(
      within(completedCard).getByText("Completed"),
    ).toBeInTheDocument();
  });
});
