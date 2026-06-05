"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import type { SubmitResult, TaskPublic, TaskStatus } from "@sql-edu/contracts";
import { reveal, submitAnswer } from "@/lib/api/study";
import { CodeBlock } from "./CodeBlock";
import { DatasetSchemaView } from "./DatasetSchemaView";
import { ResultTable } from "./ResultTable";
import { TaskStatusChip } from "./StatusChips";

/**
 * A single study task: prompt, the queryable schema, a CodeMirror SQL editor,
 * submit + result rendering, a hint toggle, and a reveal-answer flow (guarded by
 * a confirm dialog that warns it marks the task SKIPPED). Status changes are
 * lifted to the parent via `onStatusChange` so the block-complete banner can
 * react.
 */
export function TaskCard({
  task,
  index,
  onStatusChange,
  editorSlot,
}: {
  task: TaskPublic;
  index: number;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  /**
   * Render-prop for the SQL editor so the heavy CodeMirror dependency is owned
   * by StudyView (and can be swapped in tests). Receives the controlled value,
   * an onChange, and a disabled flag.
   */
  editorSlot: (props: {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
  }) => React.ReactNode;
}): React.JSX.Element {
  const [sql, setSql] = React.useState("");
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showHint, setShowHint] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [revealing, setRevealing] = React.useState(false);
  const [referenceQuery, setReferenceQuery] = React.useState<string | null>(
    null,
  );
  const [revealError, setRevealError] = React.useState<string | null>(null);

  const updateStatus = React.useCallback(
    (next: TaskStatus) => {
      setStatus(next);
      onStatusChange(task.id, next);
    },
    [onStatusChange, task.id],
  );

  const handleSubmit = React.useCallback(async () => {
    if (sql.trim().length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const res = await submitAnswer(task.id, sql);
      setResult(res);
      updateStatus(res.status);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [sql, submitting, task.id, updateStatus]);

  const handleReveal = React.useCallback(async () => {
    setConfirmOpen(false);
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await reveal(task.id);
      setReferenceQuery(res.referenceQuery);
      updateStatus(res.status);
    } catch (err) {
      setRevealError(
        err instanceof Error ? err.message : "Couldn't reveal the answer.",
      );
    } finally {
      setRevealing(false);
    }
  }, [task.id, updateStatus]);

  const completed = status === "COMPLETED";

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        p: { xs: 2, md: 2.5 },
        borderColor: completed ? "success.light" : "divider",
        borderWidth: completed ? 2 : 1,
      }}
      data-testid={`task-card-${task.id}`}
    >
      {/* Header: number + status */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 1 }}
        >
          Task {index + 1}
        </Typography>
        <TaskStatusChip status={status} />
      </Stack>

      {/* Prompt */}
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
        {task.prompt}
      </Typography>

      {/* Schema */}
      <Box sx={{ mb: 2 }}>
        <DatasetSchemaView tables={task.datasetSchema} />
      </Box>

      {/* Editor */}
      <Box sx={{ mb: 1.5 }}>
        {editorSlot({ value: sql, onChange: setSql, disabled: submitting })}
      </Box>

      {/* Actions */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: result || submitError || referenceQuery ? 2 : 0 }}
      >
        <Button
          variant="contained"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={() => void handleSubmit()}
          disabled={submitting || sql.trim().length === 0}
        >
          {submitting ? "Running…" : "Submit"}
        </Button>
        <Button
          variant="text"
          color="inherit"
          startIcon={<LightbulbOutlinedIcon />}
          onClick={() => setShowHint((s) => !s)}
          aria-expanded={showHint}
        >
          {showHint ? "Hide hint" : "Show hint"}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="text"
          color="warning"
          startIcon={<VisibilityRoundedIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={revealing}
        >
          Reveal answer
        </Button>
      </Stack>

      {/* Hint */}
      <Collapse in={showHint} unmountOnExit>
        <Alert severity="info" icon={<LightbulbOutlinedIcon />} sx={{ mb: 2 }}>
          {task.hint || "No hint available for this task."}
        </Alert>
      </Collapse>

      {/* Submission result */}
      {submitError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {submitError}
        </Alert>
      )}
      {result && <SubmitResultView result={result} />}

      {/* Revealed reference query */}
      {revealError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {revealError}
        </Alert>
      )}
      {referenceQuery && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 0.75, color: "warning.main", fontWeight: 700 }}
          >
            Reference answer
          </Typography>
          <CodeBlock aria-label="Reference answer">{referenceQuery}</CodeBlock>
        </Box>
      )}

      {/* Reveal confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Reveal the answer?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This shows the reference query and marks this task as{" "}
            <strong>Skipped</strong> (unless you&apos;ve already completed it).
            You can still keep practising afterwards.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => void handleReveal()}
            autoFocus
          >
            Reveal answer
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

/** Renders the grader's response: success, WRONG_RESULT, or another errorType. */
function SubmitResultView({
  result,
}: {
  result: SubmitResult;
}): React.JSX.Element {
  if (result.correct) {
    return (
      <Box>
        <Alert
          severity="success"
          icon={<CheckCircleRoundedIcon />}
          sx={{ mb: result.columns ? 1.5 : 0 }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Correct!</AlertTitle>
          {result.message}
        </Alert>
        {result.columns && (
          <ResultTable columns={result.columns} rows={result.rows ?? []} />
        )}
      </Box>
    );
  }

  // Incorrect. WRONG_RESULT additionally shows the user's returned rows.
  const isWrongResult = result.errorType === "WRONG_RESULT";
  return (
    <Box>
      <Alert severity={isWrongResult ? "warning" : "error"} sx={{ mb: 1.5 }}>
        <AlertTitle sx={{ fontWeight: 700 }}>
          {labelForErrorType(result.errorType)}
        </AlertTitle>
        {result.message}
      </Alert>
      {isWrongResult && result.columns && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Your query returned:
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <ResultTable columns={result.columns} rows={result.rows ?? []} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

function labelForErrorType(errorType: SubmitResult["errorType"]): string {
  switch (errorType) {
    case "WRONG_RESULT":
      return "Not quite";
    case "SYNTAX":
      return "Syntax error";
    case "TIMEOUT":
      return "Query timed out";
    case "FORBIDDEN":
      return "Not allowed";
    case "RUNTIME":
      return "Runtime error";
    default:
      return "Incorrect";
  }
}

export default TaskCard;
