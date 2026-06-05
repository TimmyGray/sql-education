"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

/**
 * Renders the USER's returned result set (columns + rows) in a compact,
 * horizontally-scrollable MUI table. Used for successful submissions and for
 * WRONG_RESULT so the learner can compare their output to the prompt.
 */
export function ResultTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: unknown[][];
}): React.JSX.Element {
  const hasColumns = columns && columns.length > 0;

  if (!hasColumns) {
    return (
      <Typography variant="body2" color="text.secondary">
        Your query returned no columns.
      </Typography>
    );
  }

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight: 320, borderRadius: 1.5 }}
      >
        <Table size="small" stickyHeader aria-label="Your query result">
          <TableHead>
            <TableRow>
              {columns.map((col, idx) => (
                <TableCell
                  key={`${col}-${idx}`}
                  sx={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    bgcolor: "grey.100",
                    fontFamily:
                      'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
                    fontSize: "0.78rem",
                  }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Typography variant="body2" color="text.secondary">
                    No rows.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rIdx) => (
                <TableRow key={rIdx} hover>
                  {columns.map((_, cIdx) => (
                    <TableCell
                      key={cIdx}
                      sx={{
                        whiteSpace: "nowrap",
                        fontFamily:
                          'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
                        fontSize: "0.78rem",
                      }}
                    >
                      {formatCell(row?.[cIdx])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 0.5, display: "block" }}
      >
        {rows.length} row{rows.length === 1 ? "" : "s"}
      </Typography>
    </Box>
  );
}

/** Render a single cell value as readable text (null/undefined → NULL). */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default ResultTable;
