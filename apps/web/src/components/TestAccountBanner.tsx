"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import { useAuth } from "@/lib/auth-context";

/** Format a millisecond duration as `m:ss`, floored at `0:00`. */
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Persistent notice for test accounts (`user.isTestAccount`): shows a live
 * countdown to `user.testAccountExpiresAt`. When it elapses, the account has
 * been (or is about to be) deleted server-side by `TestAccountCleanupService`,
 * so this logs the user out and sends them to `/login` with an explanatory
 * notice.
 */
export function TestAccountBanner(): React.JSX.Element | null {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [now, setNow] = React.useState(() => Date.now());

  const expiresAt = user?.isTestAccount ? user.testAccountExpiresAt : null;

  React.useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  React.useEffect(() => {
    if (!expiresAt) return;
    if (new Date(expiresAt).getTime() > now) return;
    let cancelled = false;
    void logout().then(() => {
      if (!cancelled) router.replace("/login?testAccountExpired=1");
    });
    return () => {
      cancelled = true;
    };
  }, [expiresAt, now, logout, router]);

  if (!expiresAt) return null;

  const remainingMs = new Date(expiresAt).getTime() - now;

  return (
    <Alert severity="info" square>
      Test account — expires in {formatRemaining(remainingMs)}. All progress
      on this account is deleted automatically when the time runs out.
    </Alert>
  );
}

export default TestAccountBanner;
