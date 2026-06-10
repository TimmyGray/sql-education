"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { RequireAuth } from "@/components/RequireAuth";
import { AppNav } from "@/components/AppNav";
import { TestAccountBanner } from "@/components/TestAccountBanner";

/**
 * Shell for authenticated pages: gates access (RequireAuth) and renders the
 * top navigation (AppNav) above the page content. Used by the dashboard, study,
 * and account route layouts. Orchestrator-owned integration glue between the
 * Wave 2 auth (E) and study (F) work.
 */
export function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <RequireAuth>
      <TestAccountBanner />
      <AppNav />
      <Box component="main">{children}</Box>
    </RequireAuth>
  );
}

export default AppShell;
