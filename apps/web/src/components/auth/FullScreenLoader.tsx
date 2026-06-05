"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

/** Centered full-viewport loading state used during auth bootstrap/redirects. */
export function FullScreenLoader({
  label = "Loading…",
}: {
  label?: string;
}): React.JSX.Element {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export default FullScreenLoader;
