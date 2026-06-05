import { DashboardView } from "@/components/study/DashboardView";

/**
 * Dashboard route — level selector, per-level XP, and the block grid.
 * The orchestrator wraps this page with AppNav + RequireAuth at integration;
 * this component renders page CONTENT only.
 */
export default function DashboardPage(): React.JSX.Element {
  return <DashboardView />;
}
