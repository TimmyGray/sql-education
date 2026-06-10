"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/auth-context";
import { isApiStatus, toFriendlyMessage } from "./errors";

/**
 * "Try a test account" button shown on the login/register forms. Creates a
 * temporary, pre-activated account (no email) and logs in as it.
 *
 * Surfaces the 429 `TEST_ACCOUNT_RATE_LIMITED` body (one test account per IP
 * per hour) with its own message; everything else falls back to
 * `toFriendlyMessage`.
 */
export function TestAccountButton({
  onError,
}: {
  /** Called with a friendly error message, or `null` to clear it. */
  onError: (message: string | null) => void;
}): React.JSX.Element {
  const router = useRouter();
  const { startTestAccount } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleClick = async (): Promise<void> => {
    setLoading(true);
    onError(null);
    try {
      await startTestAccount();
      router.push("/dashboard");
    } catch (err) {
      if (isApiStatus(err, 429)) {
        const body = err.body as { error?: string; message?: string } | undefined;
        if (body?.error === "TEST_ACCOUNT_RATE_LIMITED") {
          onError(
            body.message ??
              "Only one test account per hour is allowed from this network.",
          );
          setLoading(false);
          return;
        }
      }
      onError(
        toFriendlyMessage(
          err,
          "Could not start a test session. Please try again.",
        ),
      );
      setLoading(false);
    }
  };

  return (
    <>
      <Divider>
        <Typography variant="body2" color="text.secondary">
          or
        </Typography>
      </Divider>

      <Button
        type="button"
        variant="outlined"
        size="large"
        fullWidth
        disabled={loading}
        onClick={() => void handleClick()}
        sx={{ py: 1.25, fontWeight: 700 }}
      >
        {loading ? "Setting up test account…" : "Try a test account"}
      </Button>

      <Typography variant="caption" color="text.secondary" textAlign="center">
        No sign-up needed. Full access for 30 minutes, then it&apos;s deleted
        automatically.
      </Typography>
    </>
  );
}

export default TestAccountButton;
