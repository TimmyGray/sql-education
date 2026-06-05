import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "@/theme/theme";

/**
 * Render helper that wraps a UI tree in the MUI ThemeProvider so components
 * relying on the theme (most of ours) render correctly under jsdom. The auth
 * context is intentionally NOT provided here — tests that need it mock
 * `@/lib/auth-context` (the useAuth hook) directly.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
