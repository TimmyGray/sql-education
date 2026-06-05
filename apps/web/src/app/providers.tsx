"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/lib/auth-context";

/**
 * Client-side provider stack: MUI theme/Emotion + React Query + Auth context.
 * Rendered once from the root layout.
 */
export function Providers({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  // One QueryClient per browser session.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeRegistry>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeRegistry>
  );
}

export default Providers;
