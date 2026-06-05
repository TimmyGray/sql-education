"use client";

import * as React from "react";
import Box from "@mui/material/Box";

/**
 * A monospaced, horizontally-scrollable SQL/code block. Shared by the markdown
 * renderer, theory examples, and the revealed reference query so code styling is
 * consistent everywhere. No syntax highlighting (keeps us dependency-free) — the
 * interactive editor uses CodeMirror; this is read-only display.
 */
export function CodeBlock({
  children,
  "aria-label": ariaLabel,
}: {
  children: string;
  "aria-label"?: string;
}): React.JSX.Element {
  return (
    <Box
      component="pre"
      aria-label={ariaLabel}
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: "#0f172a",
        color: "#e2e8f0",
        fontFamily:
          '"SFMono-Regular", ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
        fontSize: "0.82rem",
        lineHeight: 1.6,
        overflowX: "auto",
        whiteSpace: "pre",
        border: "1px solid",
        borderColor: "rgba(148,163,184,0.25)",
      }}
    >
      <code>{children}</code>
    </Box>
  );
}

export default CodeBlock;
