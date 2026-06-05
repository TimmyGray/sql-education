"use client";

import * as React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";

/**
 * App Router Emotion cache + MUI theme provider.
 *
 * AppRouterCacheProvider wires Emotion's cache to Next's App Router so styles
 * are injected correctly during SSR/streaming. CssBaseline makes MUI own the
 * CSS baseline (Tailwind preflight is disabled in tailwind.config.ts).
 */
export function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

export default ThemeRegistry;
