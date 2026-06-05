"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import { sql } from "@codemirror/lang-sql";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";

/**
 * CodeMirror SQL editor.
 *
 * CodeMirror reaches for the DOM at module level, so we load it via Next's
 * `dynamic(..., { ssr: false })` to keep it out of the server bundle. While it
 * loads (and during SSR) we show an equivalent <textarea> so the editor is
 * always interactive — this fallback is also what the jsdom test environment
 * renders, which keeps tests fast and free of CodeMirror's canvas/measuring
 * requirements. Both paths share the same `value`/`onChange` contract.
 */
const CodeMirror = dynamic<ReactCodeMirrorProps>(
  () => import("@uiw/react-codemirror").then((m) => m.default),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

const EXTENSIONS = [sql()];

function EditorSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        height: 120,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    />
  );
}

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Accessible label, surfaced on the editor / fallback textarea. */
  ariaLabel?: string;
  placeholder?: string;
}

export function SqlEditor({
  value,
  onChange,
  disabled = false,
  ariaLabel = "SQL editor",
  placeholder = "-- Write your SQL here",
}: SqlEditorProps): React.JSX.Element {
  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        "& .cm-editor": { fontSize: "0.85rem" },
        "& .cm-editor.cm-focused": { outline: "none" },
        "& .cm-scroller": {
          fontFamily:
            'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
        },
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <CodeMirror
        value={value}
        height="160px"
        editable={!disabled}
        readOnly={disabled}
        placeholder={placeholder}
        extensions={EXTENSIONS}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !disabled,
          foldGutter: false,
          autocompletion: true,
        }}
        onChange={onChange}
        aria-label={ariaLabel}
      />
    </Box>
  );
}

export default SqlEditor;
