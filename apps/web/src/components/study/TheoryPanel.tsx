"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import { CodeBlock } from "./CodeBlock";
import { Markdown } from "./Markdown";
import { coerceTheoryExamples } from "./types";

/**
 * Theory side of the study view: the block's markdown theory followed by a
 * stack of worked-example cards (optional title, SQL in a code block, and an
 * explanation). Rendered inside a sticky panel by StudyView on desktop.
 */
export function TheoryPanel({
  theoryMarkdown,
  theoryExamples,
}: {
  theoryMarkdown: string;
  theoryExamples?: unknown;
}): React.JSX.Element {
  const examples = React.useMemo(
    () => coerceTheoryExamples(theoryExamples),
    [theoryExamples],
  );

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined" sx={{ borderRadius: 2, p: { xs: 2, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 1.5, color: "primary.main" }}
        >
          <MenuBookRoundedIcon fontSize="small" />
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, letterSpacing: 1 }}
          >
            Theory
          </Typography>
        </Stack>
        <Markdown source={theoryMarkdown} />
      </Card>

      {examples.length > 0 && (
        <Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5, color: "secondary.main" }}
          >
            <LightbulbRoundedIcon fontSize="small" />
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, letterSpacing: 1 }}
            >
              Worked examples
            </Typography>
          </Stack>
          <Stack spacing={2}>
            {examples.map((ex, idx) => (
              <Card
                key={idx}
                variant="outlined"
                sx={{ borderRadius: 2, overflow: "hidden" }}
              >
                <Box sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Chip
                      size="small"
                      label={`Example ${idx + 1}`}
                      color="secondary"
                      variant="outlined"
                    />
                    {ex.title && (
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {ex.title}
                      </Typography>
                    )}
                  </Stack>
                  <CodeBlock aria-label={`Example ${idx + 1} SQL`}>
                    {ex.sql}
                  </CodeBlock>
                </Box>
                <Divider />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, lineHeight: 1.7 }}
                >
                  {ex.explanation}
                </Typography>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

export default TheoryPanel;
