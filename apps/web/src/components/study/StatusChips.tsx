"use client";

import * as React from "react";
import Chip from "@mui/material/Chip";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import type { BlockStatus, TaskStatus } from "@sql-edu/contracts";

/** Small status chip for a block (dashboard cards + study header). */
export function BlockStatusChip({
  status,
  size = "small",
}: {
  status: BlockStatus;
  size?: "small" | "medium";
}): React.JSX.Element {
  switch (status) {
    case "COMPLETED":
      return (
        <Chip
          size={size}
          color="success"
          variant="filled"
          icon={<CheckCircleRoundedIcon />}
          label="Completed"
        />
      );
    case "IN_PROGRESS":
      return (
        <Chip
          size={size}
          color="primary"
          variant="outlined"
          icon={<PlayCircleRoundedIcon />}
          label="In progress"
        />
      );
    case "LOCKED":
    default:
      return (
        <Chip
          size={size}
          variant="outlined"
          icon={<LockRoundedIcon />}
          label="Locked"
          sx={{ color: "text.disabled" }}
        />
      );
  }
}

/** Small status chip for a single task. */
export function TaskStatusChip({
  status,
  size = "small",
}: {
  status: TaskStatus;
  size?: "small" | "medium";
}): React.JSX.Element {
  switch (status) {
    case "COMPLETED":
      return (
        <Chip
          size={size}
          color="success"
          variant="outlined"
          icon={<CheckCircleRoundedIcon />}
          label="Completed"
        />
      );
    case "SKIPPED":
      return (
        <Chip
          size={size}
          color="warning"
          variant="outlined"
          icon={<SkipNextRoundedIcon />}
          label="Skipped"
        />
      );
    case "NOT_STARTED":
    default:
      return (
        <Chip
          size={size}
          variant="outlined"
          icon={<RadioButtonUncheckedRoundedIcon />}
          label="Not started"
          sx={{ color: "text.secondary" }}
        />
      );
  }
}
