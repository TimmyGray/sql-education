"use client";

import * as React from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema, type Register } from "@sql-edu/contracts";
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
import { TestAccountButton } from "@/components/auth/TestAccountButton";
import { toFriendlyMessage, isApiStatus } from "@/components/auth/errors";

function RegisterForm(): React.JSX.Element {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Register>({
    resolver: zodResolver(RegisterSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(
        values.email,
        values.password,
        values.confirmPassword,
      );
      router.push(`/activate?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      if (isApiStatus(err, 409)) {
        setError("email", {
          type: "server",
          message: "That email is already registered.",
        });
        return;
      }
      setFormError(toFriendlyMessage(err));
    }
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start solving SQL tasks in minutes."
      footer={
        <Typography variant="body2" color="text.secondary">
          Already have an account?{" "}
          <Link component={NextLink} href="/login" fontWeight={600}>
            Log in
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
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.password)}
            helperText={errors.password?.message ?? "At least 8 characters."}
            {...register("password")}
          />

          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            fullWidth
            error={Boolean(errors.confirmPassword)}
            helperText={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{ py: 1.25, fontWeight: 700 }}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>

          <TestAccountButton onError={setFormError} />
        </Stack>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage(): React.JSX.Element {
  return (
    <RedirectIfAuthed>
      <RegisterForm />
    </RedirectIfAuthed>
  );
}
