"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FullScreenLoader } from "@/components/auth/FullScreenLoader";

/**
 * Gate for PROTECTED content (dashboard, study, account).
 *
 * Redirect rules:
 *  - while bootstrapping  -> loader
 *  - no user              -> /login
 *  - user is PENDING      -> /activate (must finish activation first)
 *  - otherwise            -> render children
 *
 * Redirects run in an effect (router navigation is a side effect); the loader
 * is rendered in the meantime so protected children never flash.
 */
export function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const ready = !isBootstrapping;
  const allowed = ready && user !== null && user.status === "ACTIVE";

  React.useEffect(() => {
    if (!ready) return;
    if (user === null) {
      router.replace("/login");
    } else if (user.status === "PENDING") {
      router.replace("/activate");
    }
  }, [ready, user, router]);

  if (!allowed) {
    return <FullScreenLoader />;
  }
  return <>{children}</>;
}

/**
 * Inverse gate for AUTH pages (login / register / activate).
 *
 * ACTIVE users are bounced to /dashboard. PENDING users are allowed (so they
 * can reach /activate); individual auth pages decide finer rules if needed.
 * While bootstrapping, renders the loader to avoid a form flash before a
 * silent-refresh redirect.
 */
export function RedirectIfAuthed({
  children,
  /** Where to send already-authenticated ACTIVE users. */
  to = "/dashboard",
}: {
  children: React.ReactNode;
  to?: string;
}): React.JSX.Element {
  const router = useRouter();
  const { user, isBootstrapping } = useAuth();

  const ready = !isBootstrapping;
  const isActive = ready && user !== null && user.status === "ACTIVE";

  React.useEffect(() => {
    if (isActive) {
      router.replace(to);
    }
  }, [isActive, router, to]);

  if (isBootstrapping || isActive) {
    return <FullScreenLoader />;
  }
  return <>{children}</>;
}

export default RequireAuth;
