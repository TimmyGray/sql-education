"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { BrandMark } from "./BrandMark";

/**
 * Split-screen shell for the unauthenticated auth flow (login / register /
 * activate). A vivid brand panel on the left (hidden on small screens) and the
 * form card on the right. Fully responsive — collapses to a single centered
 * column on mobile with no horizontal overflow.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
        bgcolor: "background.default",
      }}
    >
      <BrandPanel />

      <Box
        component="main"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, sm: 4 },
          py: { xs: 5, md: 6 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 440,
            p: { xs: 3, sm: 4.5 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            boxShadow:
              "0 1px 2px rgba(15,23,42,0.04), 0 12px 40px -12px rgba(15,23,42,0.18)",
          }}
        >
          {/* Brand mark shows on mobile where the side panel is hidden. */}
          <Box sx={{ display: { xs: "block", md: "none" }, mb: 3 }}>
            <BrandMark />
          </Box>

          <Stack spacing={1} sx={{ mb: 3.5 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>

          {children}

          {footer ? (
            <Box sx={{ mt: 3.5, textAlign: "center" }}>{footer}</Box>
          ) : null}
        </Paper>
      </Box>
    </Box>
  );
}

/** Decorative brand panel (left column on >= md). */
function BrandPanel(): React.JSX.Element {
  return (
    <Box
      sx={(theme) => ({
        display: { xs: "none", md: "flex" },
        position: "relative",
        flexDirection: "column",
        justifyContent: "space-between",
        p: 6,
        overflow: "hidden",
        color: "common.white",
        background: `linear-gradient(150deg, ${theme.palette.primary.dark ?? "#1e40af"} 0%, ${theme.palette.primary.main} 45%, ${theme.palette.secondary.main} 120%)`,
      })}
    >
      {/* Soft radial glow + faint grid for depth/atmosphere. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 78% 18%, rgba(255,255,255,0.22), transparent 42%), radial-gradient(circle at 12% 88%, rgba(255,255,255,0.12), transparent 38%)",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(circle at 50% 40%, black, transparent 78%)",
        }}
      />

      <Box sx={{ position: "relative" }}>
        <BrandMark variant="light" />
      </Box>

      <Stack spacing={3} sx={{ position: "relative", maxWidth: 460 }}>
        <Typography
          variant="h3"
          sx={{ fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.03em" }}
        >
          Learn SQL by solving real tasks.
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.9 }}>
          Write queries, get instant feedback, and level up from Novice to
          Middle — one block at a time.
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {[
            "Hands-on tasks graded against a real database",
            "Progress tracked across levels and blocks",
            "AI hints when you get stuck",
          ].map((line) => (
            <Stack key={line} direction="row" spacing={1.5} alignItems="center">
              <Box
                aria-hidden
                sx={(theme) => ({
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  bgcolor: alpha(theme.palette.common.white, 0.18),
                })}
              >
                ✓
              </Box>
              <Typography variant="body1" sx={{ opacity: 0.95 }}>
                {line}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>

      <Box sx={{ position: "relative" }}>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          © {new Date().getFullYear()} SQL Education
        </Typography>
      </Box>
    </Box>
  );
}

export default AuthShell;
