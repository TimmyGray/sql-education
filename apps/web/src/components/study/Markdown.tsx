"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { CodeBlock } from "./CodeBlock";

/**
 * Tiny, dependency-free Markdown renderer covering exactly the subset the
 * theory content uses: ATX headings (`#`..`###`), fenced code blocks
 * (```lang ... ```), unordered lists (`-`/`*`), blank-line-separated
 * paragraphs, and the inline spans `**bold**` and `` `code` ``.
 *
 * We intentionally do NOT use dangerouslySetInnerHTML — every node is a real
 * React element, so there is no XSS surface from the markdown source.
 */

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(/^```/);
    if (fence) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // consume closing fence (if present)
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    // List (consecutive `-`/`*` bullets).
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    // Blank line → separator.
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph (gather until blank / structural line).
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

/** Render inline `**bold**` and `` `code` `` spans within a line of text. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on inline code first (so ** inside code is preserved literally).
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <Box
          key={`${keyBase}-c${idx}`}
          component="code"
          sx={{
            px: 0.5,
            py: 0.1,
            borderRadius: 0.75,
            bgcolor: "rgba(37,99,235,0.10)",
            color: "primary.dark",
            fontFamily:
              'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
            fontSize: "0.85em",
            wordBreak: "break-word",
          }}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }
    // Bold spans within plain text.
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={`${keyBase}-t${idx}`}>
        {boldParts.map((bp, bidx) =>
          bp.startsWith("**") && bp.endsWith("**") && bp.length >= 4 ? (
            <Box
              key={`${keyBase}-b${idx}-${bidx}`}
              component="strong"
              sx={{ fontWeight: 700 }}
            >
              {bp.slice(2, -2)}
            </Box>
          ) : (
            <React.Fragment key={`${keyBase}-p${idx}-${bidx}`}>
              {bp}
            </React.Fragment>
          ),
        )}
      </React.Fragment>
    );
  });
}

export function Markdown({ source }: { source: string }): React.JSX.Element {
  const blocks = React.useMemo(() => parseBlocks(source ?? ""), [source]);

  return (
    <Box sx={{ "& > * + *": { mt: 1.5 } }}>
      {blocks.map((block, idx) => {
        const key = `md-${idx}`;
        switch (block.kind) {
          case "heading": {
            const variant =
              block.level === 1 ? "h5" : block.level === 2 ? "h6" : "subtitle1";
            return (
              <Typography
                key={key}
                variant={variant}
                component={`h${block.level + 1}` as "h2" | "h3" | "h4"}
                sx={{ fontWeight: 700, mt: idx === 0 ? 0 : 2.5 }}
              >
                {renderInline(block.text, key)}
              </Typography>
            );
          }
          case "code":
            return <CodeBlock key={key}>{block.text}</CodeBlock>;
          case "list":
            return (
              <Box
                key={key}
                component="ul"
                sx={{ pl: 3, m: 0, "& > li": { mb: 0.5 } }}
              >
                {block.items.map((item, iidx) => (
                  <Typography
                    key={`${key}-li${iidx}`}
                    component="li"
                    variant="body2"
                    sx={{ color: "text.secondary", lineHeight: 1.6 }}
                  >
                    {renderInline(item, `${key}-li${iidx}`)}
                  </Typography>
                ))}
              </Box>
            );
          case "paragraph":
          default:
            return (
              <Typography
                key={key}
                variant="body2"
                sx={{ color: "text.secondary", lineHeight: 1.7 }}
              >
                {renderInline(block.text, key)}
              </Typography>
            );
        }
      })}
    </Box>
  );
}

export default Markdown;
