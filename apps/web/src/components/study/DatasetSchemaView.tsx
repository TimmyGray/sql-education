"use client";

import * as React from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import type { DatasetTable } from "@sql-edu/contracts";

/**
 * Collapsible "Tables you can query" view. Renders each table name and its
 * columns as `name type` pills. Defaults collapsed to keep the task compact;
 * fully usable at narrow widths (columns wrap).
 */
export function DatasetSchemaView({
  tables,
}: {
  tables: DatasetTable[];
}): React.JSX.Element | null {
  if (!tables || tables.length === 0) return null;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        "&:before": { display: "none" },
        bgcolor: "background.paper",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        aria-label="Toggle tables you can query"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TableChartRoundedIcon fontSize="small" color="action" />
          <Typography variant="subtitle2">Tables you can query</Typography>
          <Chip
            size="small"
            label={tables.length}
            sx={{ height: 18, fontSize: "0.7rem" }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {tables.map((table) => (
            <Box key={table.tableName}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  fontFamily:
                    'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
                  mb: 0.75,
                }}
              >
                {table.tableName}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.75,
                }}
              >
                {table.columns.map((col) => (
                  <Chip
                    key={col.name}
                    size="small"
                    variant="outlined"
                    label={
                      <Box component="span">
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {col.name}
                        </Box>{" "}
                        <Box
                          component="span"
                          sx={{ color: "text.secondary", fontSize: "0.72rem" }}
                        >
                          {col.type}
                        </Box>
                      </Box>
                    }
                    sx={{
                      fontFamily:
                        'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export default DatasetSchemaView;
