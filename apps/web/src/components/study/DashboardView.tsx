"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import type { BlockSummary, Dashboard, Level, LevelProgress } from "@sql-edu/contracts";
import { getDashboard } from "@/lib/api/study";
import { BlockCard } from "./BlockCard";
import { LEVEL_LABELS, LEVEL_ORDER } from "./types";

/**
 * Dashboard: pick a level, see its XP, browse its blocks. Fetching is done with
 * react-query; loading/error/empty states are all handled here. Navigation to a
 * block goes through Next's router (LOCKED blocks never navigate — enforced in
 * BlockCard).
 */
export function DashboardView(): React.JSX.Element {
  const router = useRouter();
  const [level, setLevel] = React.useState<Level>("NOVICE");

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<Dashboard>({
      queryKey: ["dashboard"],
      queryFn: getDashboard,
    });

  const levelData: LevelProgress | undefined = React.useMemo(
    () => data?.levels.find((l) => l.level === level),
    [data, level],
  );

  const handleOpen = React.useCallback(
    (block: BlockSummary) => {
      router.push(`/study/${block.level}/${block.id}`);
    },
    [router],
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          Your learning path
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Work through blocks of theory and hands-on SQL tasks to level up.
        </Typography>
      </Stack>

      {/* Level selector */}
      <Tabs
        value={level}
        onChange={(_, v: Level) => setLevel(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Select a level"
        sx={{
          mb: 1,
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none" },
        }}
      >
        {LEVEL_ORDER.map((lvl) => (
          <Tab key={lvl} value={lvl} label={LEVEL_LABELS[lvl]} />
        ))}
      </Tabs>

      {/* XP summary for the selected level */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ my: 3, flexWrap: "wrap", gap: 1 }}
      >
        <Chip
          icon={<BoltRoundedIcon />}
          color="secondary"
          variant="filled"
          label={
            <Box component="span">
              <Box component="span" sx={{ fontWeight: 800 }}>
                {levelData?.xp ?? 0}
              </Box>{" "}
              XP
            </Box>
          }
          sx={{ fontSize: "0.9rem", px: 0.5, height: 34 }}
        />
        <Typography variant="body2" color="text.secondary">
          earned in {LEVEL_LABELS[level]}
        </Typography>
        {isFetching && !isLoading && (
          <CircularProgress size={16} aria-label="Refreshing" />
        )}
      </Stack>

      {isLoading && <LoadingGrid />}

      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Couldn&apos;t load your dashboard
          {error instanceof Error ? `: ${error.message}` : "."}
        </Alert>
      )}

      {!isLoading && !isError && levelData && (
        <BlockGrid blocks={levelData.blocks} onOpen={handleOpen} level={level} />
      )}

      {!isLoading && !isError && !levelData && (
        <ComingSoon level={level} />
      )}
    </Container>
  );
}

function BlockGrid({
  blocks,
  onOpen,
  level,
}: {
  blocks: BlockSummary[];
  onOpen: (block: BlockSummary) => void;
  level: Level;
}): React.JSX.Element {
  if (blocks.length === 0) {
    return <ComingSoon level={level} />;
  }
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
      }}
    >
      {blocks.map((block) => (
        <BlockCard key={block.id} block={block} onOpen={onOpen} />
      ))}
    </Box>
  );
}

function LoadingGrid(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
      }}
      aria-label="Loading blocks"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={180}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </Box>
  );
}

function ComingSoon({ level }: { level: Level }): React.JSX.Element {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: { xs: 6, md: 9 },
        px: 2,
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "action.hover",
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          mb: 2,
          color: "text.secondary",
        }}
      >
        {level === "NOVICE" ? (
          <AutoGraphRoundedIcon sx={{ fontSize: 48 }} />
        ) : (
          <ConstructionRoundedIcon sx={{ fontSize: 48 }} />
        )}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {LEVEL_LABELS[level]} content is coming soon
      </Typography>
      <Typography variant="body2" color="text.secondary">
        New blocks for this level are on the way. In the meantime, keep
        practising in Novice.
      </Typography>
    </Box>
  );
}

export default DashboardView;
