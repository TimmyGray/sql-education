"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

const LENGTH = 6;
/** Codes are alphanumeric, 6 chars; normalize to uppercase. */
const ALLOWED = /[^a-zA-Z0-9]/g;

/**
 * Segmented 6-character activation-code input. Renders six boxes backed by a
 * single controlled string. Supports typing, paste, Backspace, and arrow keys,
 * and auto-advances focus. Calls `onComplete` when all six chars are present.
 *
 * Accessibility: each cell is a real <input> with an aria-label; the group is
 * labelled by `aria-label` on the container.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  invalid = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const chars = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");

  const focusCell = (i: number) => {
    const target = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    target?.focus();
    target?.select();
  };

  const commit = (next: string) => {
    const cleaned = next.replace(ALLOWED, "").toUpperCase().slice(0, LENGTH);
    onChange(cleaned);
    if (cleaned.length === LENGTH) {
      onComplete?.(cleaned);
    }
    return cleaned;
  };

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(ALLOWED, "").toUpperCase();
    if (!typed) return;
    const arr = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
    // Take the last typed character (handles overtype on a filled cell).
    arr[index] = typed[typed.length - 1];
    const joined = arr.join("").replace(/\s+$/g, "");
    commit(joined);
    focusCell(index + 1);
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
      if (arr[index] && arr[index] !== " ") {
        arr[index] = " ";
        onChange(arr.join("").replace(/\s+$/g, ""));
      } else if (index > 0) {
        arr[index - 1] = " ";
        onChange(arr.join("").replace(/\s+$/g, ""));
        focusCell(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusCell(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const cleaned = commit(pasted);
    focusCell(cleaned.length >= LENGTH ? LENGTH - 1 : cleaned.length);
  };

  return (
    <Box
      role="group"
      aria-label="6-character activation code"
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: { xs: 1, sm: 1.25 },
      }}
    >
      {chars.map((char, i) => {
        const filled = char.trim().length > 0;
        return (
          <Box
            key={i}
            component="input"
            // Controlled cell.
            ref={(el: HTMLInputElement | null) => {
              refs.current[i] = el;
            }}
            value={char.trim()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange(i, e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
              handleKeyDown(i, e)
            }
            onPaste={handlePaste}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) =>
              e.target.select()
            }
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            sx={{
              width: "100%",
              minWidth: 0,
              aspectRatio: "1 / 1",
              textAlign: "center",
              fontSize: { xs: "1.25rem", sm: "1.5rem" },
              fontWeight: 700,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              color: theme.palette.text.primary,
              caretColor: theme.palette.primary.main,
              borderRadius: 10,
              border: "1.5px solid",
              borderColor: invalid
                ? theme.palette.error.main
                : filled
                  ? theme.palette.primary.main
                  : theme.palette.divider,
              backgroundColor: disabled
                ? theme.palette.action.disabledBackground
                : theme.palette.background.paper,
              outline: "none",
              transition: "border-color 120ms ease, box-shadow 120ms ease",
              "&:focus": {
                borderColor: invalid
                  ? theme.palette.error.main
                  : theme.palette.primary.main,
                boxShadow: `0 0 0 3px ${
                  invalid
                    ? theme.palette.error.main
                    : theme.palette.primary.main
                }33`,
              },
            }}
          />
        );
      })}
    </Box>
  );
}

export default CodeInput;
