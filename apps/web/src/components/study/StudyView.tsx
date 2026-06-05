"use client";

import * as React from "react";
import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import type { BlockContent, TaskStatus } from "@sql-edu/contracts";
import { ApiError } from "@/lib/api-client";
import { getBlock } from "@/lib/api/study";
import { AiTutorDrawer } from "./AiTutorDrawer";
import { BlockStatusChip } from "./StatusChips";
import { SqlEditor } from "./SqlEditor";
import { TaskCard } from "./TaskCard";
import { TheoryPanel } from "./TheoryPanel";
import { LEVEL_LABELS } from "./types";

/**
 * Study a single block: theory + worked examples on one side, the interactive
 * tasks on the other, plus the AI tutor drawer. Responsive: side-by-side on
 * desktop, stacked (theory first) on mobile. Tracks live per-task status to
 * drive a block-complete banner once every task is COMPLETED or SKIPPED.
 */
export function StudyView({
  blockId,
}: {
  blockId: string;
}): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery<BlockContent>({
    queryKey: ["block", blockId],
    queryFn: () => getBlock(blockId),
  });

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Live per-task status, seeded from the fetched content.
  const [statuses, setStatuses] = React.useState<Record<string, TaskStatus>>(
    {},
  );

  React.useEffect(() => {
    if (data) {
      setStatuses(
        Object.fromEntries(data.tasks.map((t) => [t.id, t.status])),
      );
    }
  }, [data]);

  const handleStatusChange = React.useCallback(
    (taskId: string, status: TaskStatus) => {
      setStatuses((prev) => ({ ...prev, [taskId]: status }));
    },
    [],
  );

  if (isLoading) {
    return <StudySkeleton />;
  }

  if (isError) {
    const locked = error instanceof ApiError && error.status === 403;
    return (
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <BackLink />
        <Alert
          severity={locked ? "warning" : "error"}
          sx={{ mt: 2 }}
          action={
            locked ? undefined : (
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Retry
              </Button>
            )
          }
        >
          {locked
            ? "This block is locked. Complete the previous block to unlock it."
            : `Couldn't load this block${
                error instanceof Error ? `: ${error.message}` : "."
              }`}
        </Alert>
      </Container>
    );
  }

  if (!data) return <StudySkeleton />;

  const total = data.tasks.length;
  const done = data.tasks.filter(
    (t) => statuses[t.id] === "COMPLETED" || statuses[t.id] === "SKIPPED",
  ).length;
  const completedCount = data.tasks.filter(
    (t) => statuses[t.id] === "COMPLETED",
  ).length;
  const allResolved = total > 0 && done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <BackLink />

      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1.5}
        sx={{ mt: 1.5, mb: 1 }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 700, letterSpacing: 1 }}
          >
            {LEVEL_LABELS[data.level]} · Block {data.order}
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            {data.title}
          </Typography>
        </Box>
        <BlockStatusChip status={data.status} size="medium" />
      </Stack>

      {/* Progress bar */}
      <Box sx={{ mb: 4 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mb: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            {done} of {total} tasks resolved
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {pct}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          color={allResolved ? "success" : "primary"}
          sx={{ height: 8, borderRadius: 4 }}
          aria-label={`${done} of ${total} tasks resolved`}
        />
      </Box>

      {/* Two-column layout: theory + tasks. Stacks on mobile (theory first). */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, md: 4 },
          // `minmax(0, …)` on every track (including the single mobile column)
          // lets the track shrink below its content's intrinsic width, so wide
          // code/`<pre>` theory blocks scroll internally instead of forcing the
          // whole page to overflow horizontally on a phone.
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 5fr) minmax(0, 7fr)",
          },
          alignItems: "start",
        }}
      >
        {/* Theory — sticky on desktop */}
        <Box
          sx={{
            position: { md: "sticky" },
            top: { md: 24 },
            maxHeight: { md: "calc(100vh - 48px)" },
            overflowY: { md: "auto" },
            pr: { md: 1 },
          }}
        >
          <TheoryPanel
            theoryMarkdown={data.theoryMarkdown}
            theoryExamples={data.theoryExamples}
          />
        </Box>

        {/* Tasks */}
        <Stack spacing={3}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Tasks
          </Typography>

          {allResolved && (
            <BlockCompleteBanner
              level={data.level}
              xp={null}
              completedCount={completedCount}
              total={total}
            />
          )}

          {data.tasks.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              index={idx}
              onStatusChange={handleStatusChange}
              editorSlot={({ value, onChange, disabled }) => (
                <SqlEditor
                  value={value}
                  onChange={onChange}
                  disabled={disabled}
                  ariaLabel={`SQL editor for task ${idx + 1}`}
                />
              )}
            />
          ))}

          {total === 0 && (
            <Alert severity="info">
              This block has no tasks yet — check back soon.
            </Alert>
          )}
        </Stack>
      </Box>

      {/* AI tutor: FAB + drawer */}
      <Fab
        color="secondary"
        variant="extended"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open SQL tutor"
        sx={{
          position: "fixed",
          bottom: { xs: 16, md: 24 },
          right: { xs: 16, md: 24 },
          zIndex: (t) => t.zIndex.drawer - 1,
          textTransform: "none",
          fontWeight: 700,
        }}
      >
        <SmartToyRoundedIcon sx={{ mr: 1 }} />
        Ask the tutor
      </Fab>

      <AiTutorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        blockId={data.id}
        initialRemaining={data.aiQuestionsRemaining}
      />
    </Container>
  );
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      component={NextLink}
      href="/dashboard"
      underline="hover"
      color="text.secondary"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: "0.875rem",
      }}
    >
      <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
      Back to dashboard
    </Link>
  );
}

function BlockCompleteBanner({
  level,
  xp,
  completedCount,
  total,
}: {
  level: BlockContent["level"];
  xp: number | null;
  completedCount: number;
  total: number;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 3,
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.success.main} 0%, ${t.palette.success.dark} 100%)`,
        color: "common.white",
      }}
      role="status"
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <CelebrationRoundedIcon />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Block complete!
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ opacity: 0.95, mb: 2 }}>
        You resolved all {total} tasks ({completedCount} solved
        {completedCount < total ? `, ${total - completedCount} revealed` : ""}).
        {xp != null
          ? ` You've earned ${xp} XP in ${LEVEL_LABELS[level]}.`
          : ` Your ${LEVEL_LABELS[level]} XP has been updated.`}
      </Typography>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.3)", mb: 2 }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button
          component={NextLink}
          href="/dashboard"
          variant="contained"
          sx={{
            bgcolor: "common.white",
            color: "success.dark",
            "&:hover": { bgcolor: "grey.100" },
          }}
        >
          Back to dashboard
        </Button>
      </Stack>
    </Box>
  );
}

function StudySkeleton(): React.JSX.Element {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Skeleton width={160} height={24} />
      <Skeleton width="60%" height={48} sx={{ mt: 1 }} />
      <Skeleton variant="rounded" height={8} sx={{ my: 3, borderRadius: 4 }} />
      <Box
        sx={{
          display: "grid",
          gap: 4,
          gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
        }}
      >
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 2 }} />
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 2 }} />
        </Stack>
      </Box>
    </Container>
  );
}

export default StudyView;
