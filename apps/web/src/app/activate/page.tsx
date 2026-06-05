"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { useAuth } from "@/lib/auth-context";
import { RedirectIfAuthed } from "@/components/RequireAuth";
import { AuthShell } from "@/components/auth/AuthShell";
import { CodeInput } from "@/components/auth/CodeInput";
import { toFriendlyMessage, isApiStatus } from "@/components/auth/errors";

const RESEND_COOLDOWN_SECONDS = 60;
const MAILHOG_URL = "http://localhost:8025";

/** Live countdown timer. Returns remaining seconds and a `start(seconds)` fn. */
function useCooldown(): {
  remaining: number;
  active: boolean;
  start: (seconds: number) => void;
} {
  const [remaining, setRemaining] = React.useState(0);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const start = React.useCallback((seconds: number) => {
    setRemaining(seconds);
  }, []);

  return { remaining, active: remaining > 0, start };
}

function ActivateForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activate, resendCode } = useAuth();

  const emailFromQuery = searchParams.get("email") ?? "";
  const [email, setEmail] = React.useState(emailFromQuery);
  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const cooldown = useCooldown();

  // Keep local email in sync if the query param resolves after mount.
  React.useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  const doActivate = React.useCallback(
    async (submittedCode: string) => {
      if (!email) {
        setError("Enter the email you registered with.");
        return;
      }
      if (submittedCode.length !== 6) {
        setError("Enter the full 6-character code.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await activate(email, submittedCode);
        router.push("/dashboard");
      } catch (err) {
        setError(
          isApiStatus(err, 400)
            ? "That code is incorrect or has expired. Request a new one below."
            : toFriendlyMessage(err),
        );
        setSubmitting(false);
      }
    },
    [activate, email, router],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void doActivate(code);
  };

  const onResend = async () => {
    if (!email) {
      setError("Enter the email you registered with first.");
      return;
    }
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await resendCode(email);
      setInfo("A new code is on its way. Check your email.");
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (isApiStatus(err, 429)) {
        // Server-enforced cooldown — reflect it locally too.
        cooldown.start(RESEND_COOLDOWN_SECONDS);
        setError("Please wait before requesting another code.");
      } else {
        setError(toFriendlyMessage(err));
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        email
          ? `Enter the 6-character code we sent to ${email}.`
          : "Enter your email and the 6-character code we sent you."
      }
      footer={
        <Typography variant="body2" color="text.secondary">
          Entered the wrong email?{" "}
          <Link href="/register" fontWeight={600}>
            Register again
          </Link>
        </Typography>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2.5}>
          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}
          {info ? (
            <Alert severity="success" onClose={() => setInfo(null)}>
              {info}
            </Alert>
          ) : null}

          {/* Show the email field only when we didn't receive it via the URL. */}
          {!emailFromQuery ? (
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : null}

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600 }}
              id="code-label"
            >
              Activation code
            </Typography>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(c) => void doActivate(c)}
              disabled={submitting}
              invalid={Boolean(error) && code.length > 0}
              autoFocus={Boolean(emailFromQuery)}
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || code.length !== 6}
            sx={{ py: 1.25, fontWeight: 700 }}
          >
            {submitting ? "Activating…" : "Activate account"}
          </Button>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Didn&apos;t get it?
            </Typography>
            <Button
              type="button"
              variant="text"
              onClick={onResend}
              disabled={resending || cooldown.active}
            >
              {cooldown.active
                ? `Resend in ${cooldown.remaining}s`
                : resending
                  ? "Sending…"
                  : "Resend code"}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary">
            Codes expire shortly for security. In local development, view sent
            emails in{" "}
            <Link href={MAILHOG_URL} target="_blank" rel="noopener noreferrer">
              MailHog
            </Link>
            .
          </Typography>
        </Stack>
      </form>
    </AuthShell>
  );
}

export default function ActivatePage(): React.JSX.Element {
  return (
    <RedirectIfAuthed>
      {/* useSearchParams requires a Suspense boundary during prerender. */}
      <React.Suspense fallback={null}>
        <ActivateForm />
      </React.Suspense>
    </RedirectIfAuthed>
  );
}
