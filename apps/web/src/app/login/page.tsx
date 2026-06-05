"use client";

import * as React from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema, type Login } from "@sql-edu/contracts";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useAuth } from "@/lib/auth-context";
import { RedirectIfAuthed } from "@/components/RequireAuth";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { toFriendlyMessage, isApiStatus } from "@/components/auth/errors";

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const { login } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Login>({
    resolver: zodResolver(LoginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.push("/dashboard");
    } catch (err) {
      // 403 PENDING -> the account exists but isn't activated yet.
      if (isApiStatus(err, 403)) {
        router.push(
          `/activate?email=${encodeURIComponent(getValues("email"))}`,
        );
        return;
      }
      setFormError(toFriendlyMessage(err));
    }
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your SQL journey."
      footer={
        <Typography variant="body2" color="text.secondary">
          New here?{" "}
          <Link component={NextLink} href="/register" fontWeight={600}>
            Create an account
          </Link>
        </Typography>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2.5}>
          {formError ? (
            <Alert severity="error" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          ) : null}

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            fullWidth
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register("email")}
          />

          <PasswordField
            label="Password"
            autoComplete="current-password"
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register("password")}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{ py: 1.25, fontWeight: 700 }}
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <RedirectIfAuthed>
      <LoginForm />
    </RedirectIfAuthed>
  );
}
