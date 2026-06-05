"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import type { BlockSummary } from "@sql-edu/contracts";
import { BlockStatusChip } from "./StatusChips";

/**
 * One block on the dashboard grid. LOCKED blocks are visually muted and NOT
 * interactive (no link, not focusable). IN_PROGRESS / COMPLETED blocks are a
 * clickable card that calls `onOpen`. Progress bar reflects completed/total.
 */
export function BlockCard({
  block,
  onOpen,
}: {
  block: BlockSummary;
  onOpen: (block: BlockSummary) => void;
}): React.JSX.Element {
  const locked = block.status === "LOCKED";
  const pct =
    block.totalTasks > 0
      ? Math.round((block.completedTasks / block.totalTasks) * 100)
      : 0;

  const inner = (
    <Box sx={{ p: 2.5 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Typography
          variant="overline"
          sx={{ color: "text.secondary", letterSpacing: 1 }}
        >
          Block {block.order}
        </Typography>
        <BlockStatusChip status={block.status} />
      </Stack>

      <Typography
        variant="h6"
        component="h3"
        sx={{
          fontWeight: 700,
          mb: 2,
          color: locked ? "text.disabled" : "text.primary",
          minHeight: "2.6em",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {block.title}
      </Typography>

      <Stack spacing={0.75}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="caption" color="text.secondary">
            {block.completedTasks} / {block.totalTasks} tasks
          </Typography>
          {!locked && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                color: "primary.main",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {block.status === "COMPLETED" ? "Review" : "Continue"}
              </Typography>
              <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
            </Box>
          )}
        </Stack>
        <LinearProgress
          variant="determinate"
          value={locked ? 0 : pct}
          color={block.status === "COMPLETED" ? "success" : "primary"}
          aria-label={`Progress: ${block.completedTasks} of ${block.totalTasks} tasks`}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: "action.hover",
          }}
        />
      </Stack>
    </Box>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        transition: "border-color 120ms, box-shadow 120ms, transform 120ms",
        ...(locked
          ? { bgcolor: "action.hover", borderStyle: "dashed" }
          : {
              "&:hover": {
                borderColor: "primary.main",
                boxShadow: 3,
                transform: "translateY(-2px)",
              },
            }),
      }}
    >
      {locked ? (
        <Tooltip title="Complete the previous block to unlock this one">
          <Box
            aria-disabled="true"
            data-testid={`block-card-locked-${block.id}`}
          >
            {inner}
          </Box>
        </Tooltip>
      ) : (
        <CardActionArea
          onClick={() => onOpen(block)}
          data-testid={`block-card-${block.id}`}
          sx={{ height: "100%" }}
        >
          {inner}
        </CardActionArea>
      )}
    </Card>
  );
}

export default BlockCard;
