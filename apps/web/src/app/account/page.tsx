"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "@/lib/auth-context";
import { RequireAuth } from "@/components/RequireAuth";
import { toFriendlyMessage } from "@/components/auth/errors";

/** Local form schema mirroring UpdateProfileSchema's displayName rule. */
const ProfileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name can't be empty.")
    .max(60, "Keep it under 60 characters."),
});
type ProfileForm = z.infer<typeof ProfileFormSchema>;

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function AccountContent(): React.JSX.Element {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    mode: "onTouched",
    defaultValues: { displayName: user?.displayName ?? "" },
  });

  // Re-sync the form default once the user is (re)hydrated.
  React.useEffect(() => {
    reset({ displayName: user?.displayName ?? "" });
  }, [user?.displayName, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await updateProfile(values.displayName.trim());
      reset({ displayName: updated.displayName ?? "" });
      setSuccess(true);
    } catch (err) {
      setFormError(toFriendlyMessage(err));
    }
  });

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  if (!user) return <></>;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          Account
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your profile and session.
        </Typography>
      </Stack>

      {/* Identity card */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2.5}
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              fontSize: 22,
              fontWeight: 700,
              bgcolor: "primary.main",
            }}
          >
            {initialsOf(user.displayName, user.email)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
              {user.displayName?.trim() || "No display name yet"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {user.email}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                size="small"
                label={user.status === "ACTIVE" ? "Active" : "Pending"}
                color={user.status === "ACTIVE" ? "success" : "warning"}
                variant="outlined"
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Member since ${formatJoined(user.createdAt)}`}
              />
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Edit profile */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          This name appears across the app.
        </Typography>

        <form onSubmit={onSubmit} noValidate>
          <Stack spacing={2.5}>
            {formError ? (
              <Alert severity="error" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            ) : null}

            <TextField
              label="Display name"
              fullWidth
              placeholder="e.g. Ada Lovelace"
              error={Boolean(errors.displayName)}
              helperText={errors.displayName?.message}
              {...register("displayName")}
            />

            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting || !isDirty}
                sx={{ fontWeight: 700 }}
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>

      {/* Session */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Session
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Log out of this device.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </Paper>

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccess(false)}
        >
          Profile updated.
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default function AccountPage(): React.JSX.Element {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}
