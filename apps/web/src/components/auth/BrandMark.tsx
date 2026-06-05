"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

/**
 * The SQL Education wordmark + logo glyph. `variant="light"` renders for dark
 * backgrounds (the brand panel); the default renders for light surfaces.
 */
export function BrandMark({
  variant = "default",
  size = "md",
}: {
  variant?: "default" | "light";
  size?: "sm" | "md";
}): React.JSX.Element {
  const light = variant === "light";
  const glyph = size === "sm" ? 30 : 38;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
        userSelect: "none",
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: glyph,
          height: glyph,
          borderRadius: size === "sm" ? 2 : 2.5,
          display: "grid",
          placeItems: "center",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontWeight: 800,
          fontSize: size === "sm" ? 13 : 15,
          letterSpacing: "-0.04em",
          color: light ? theme.palette.primary.main : theme.palette.common.white,
          background: light
            ? theme.palette.common.white
            : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          boxShadow: light
            ? "none"
            : `0 6px 16px -6px ${alpha(theme.palette.primary.main, 0.6)}`,
        })}
      >
        {"</>"}
      </Box>
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          fontSize: size === "sm" ? "1.05rem" : "1.2rem",
          letterSpacing: "-0.02em",
          color: light ? "common.white" : "text.primary",
        }}
      >
        SQL
        <Box
          component="span"
          sx={{
            fontWeight: 500,
            color: light ? alpha("#ffffff", 0.75) : "text.secondary",
          }}
        >
          {" "}
          Education
        </Box>
      </Typography>
    </Box>
  );
}

export default BrandMark;
