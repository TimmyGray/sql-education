"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { askAi } from "@/lib/api/ai";
import type { ChatMessage } from "./types";

/**
 * AI tutor chat in an MUI Drawer (right side on desktop, bottom-sheet-ish full
 * width on mobile). The conversation lives in local state; remaining questions
 * start from `initialRemaining` and follow the server's `questionsRemaining`
 * after each reply. When 0, the input is disabled. `refused` replies get a
 * subtle "won't give the answer" treatment.
 *
 * The tutor never returns the solution — that is expected and surfaced gently.
 */
export function AiTutorDrawer({
  open,
  onClose,
  blockId,
  initialRemaining,
}: {
  open: boolean;
  onClose: () => void;
  blockId: string;
  initialRemaining: number;
}): React.JSX.Element {
  const [remaining, setRemaining] = React.useState(initialRemaining);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const listEndRef = React.useRef<HTMLDivElement | null>(null);

  // Keep the local counter in sync if the block (and its quota) changes.
  React.useEffect(() => {
    setRemaining(initialRemaining);
  }, [initialRemaining, blockId]);

  React.useEffect(() => {
    // Guarded: scrollIntoView is unimplemented in jsdom (tests) and may be
    // missing on some targets.
    listEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, sending]);

  const disabled = remaining <= 0 || sending;

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || disabled) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await askAi(blockId, text);
      setRemaining(res.questionsRemaining);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.reply,
          refused: res.refused,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text:
            err instanceof Error
              ? `Something went wrong: ${err.message}`
              : "Something went wrong. Please try again.",
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, disabled, blockId]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: 420 },
          maxWidth: "100vw",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ p: 2, pb: 1.5 }}
      >
        <Box
          sx={{
            display: "inline-flex",
            p: 1,
            borderRadius: 2,
            bgcolor: "secondary.main",
            color: "secondary.contrastText",
          }}
        >
          <SmartToyRoundedIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            SQL Tutor
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Hints &amp; explanations — not the answer
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close tutor" size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>

      <Box sx={{ px: 2, pb: 1 }}>
        <Chip
          size="small"
          color={remaining > 0 ? "primary" : "default"}
          variant="outlined"
          label={`${remaining} question${remaining === 1 ? "" : "s"} left`}
        />
      </Box>
      <Divider />

      {/* Messages */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          px: 2,
          py: 2,
          bgcolor: "grey.50",
        }}
      >
        {messages.length === 0 && (
          <Stack
            spacing={1}
            alignItems="center"
            sx={{ color: "text.secondary", mt: 4, textAlign: "center", px: 2 }}
          >
            <SmartToyRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
            <Typography variant="body2">
              Stuck on a task? Ask for a nudge, an explanation of a concept, or
              what&apos;s wrong with your query.
            </Typography>
          </Stack>
        )}

        <Stack spacing={1.5}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {sending && (
            <Box
              sx={{
                alignSelf: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "text.secondary",
              }}
            >
              <CircularProgress size={14} />
              <Typography variant="caption">Tutor is thinking…</Typography>
            </Box>
          )}
          <div ref={listEndRef} />
        </Stack>
      </Box>

      <Divider />

      {/* Composer */}
      <Box sx={{ p: 2 }}>
        {remaining <= 0 && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            You&apos;ve used all your tutor questions for this block.
          </Alert>
        )}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder={
              remaining > 0 ? "Ask the tutor…" : "No questions remaining"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={disabled}
            inputProps={{ "aria-label": "Message the tutor" }}
          />
          <IconButton
            color="primary"
            onClick={() => void send()}
            disabled={disabled || input.trim().length === 0}
            aria-label="Send message"
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "&:hover": { bgcolor: "primary.dark" },
              "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
            }}
          >
            <SendRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Drawer>
  );
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  const isUser = message.role === "user";
  return (
    <Box
      sx={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 1,
          borderRadius: 2,
          ...(isUser
            ? {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                borderBottomRightRadius: 4,
              }
            : message.error
              ? {
                  bgcolor: "error.50",
                  color: "error.main",
                  border: "1px solid",
                  borderColor: "error.light",
                  borderBottomLeftRadius: 4,
                }
              : message.refused
                ? {
                    bgcolor: "warning.50",
                    color: "text.primary",
                    border: "1px dashed",
                    borderColor: "warning.main",
                    borderBottomLeftRadius: 4,
                  }
                : {
                    bgcolor: "background.paper",
                    color: "text.primary",
                    border: "1px solid",
                    borderColor: "divider",
                    borderBottomLeftRadius: 4,
                  }),
        }}
      >
        <Typography
          variant="body2"
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {message.text}
        </Typography>
      </Box>
      {message.refused && (
        <Typography
          variant="caption"
          sx={{ color: "warning.main", mt: 0.5, display: "block", pl: 0.5 }}
        >
          The tutor won&apos;t give the solution — try the hint or rephrase.
        </Typography>
      )}
    </Box>
  );
}

export default AiTutorDrawer;
