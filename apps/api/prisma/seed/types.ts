/**
 * Shared types for the seed content modules.
 * These mirror the Prisma schema shapes exactly.
 */

export type DatasetColumn = {
  name: string;
  type: string;
};

export type DatasetTable = {
  tableName: string;
  columns: DatasetColumn[];
};

export type TheoryExample = {
  title?: string;
  sql: string;
  explanation: string;
};

export type ExpectedResult = {
  columns: string[];
  rows: unknown[][];
};

export type TaskDef = {
  order: number;
  prompt: string;
  hint: string;
  referenceQuery: string;
  comparisonMode: "ORDERED" | "UNORDERED";
  expectedResultJson: ExpectedResult;
  datasetName: string; // references SandboxDatasetDef.name
};

export type SandboxDatasetDef = {
  name: string;
  setupSql: string;
  schemaJson: DatasetTable[];
};

export type Level = "NOVICE" | "JUNIOR" | "MIDDLE";

export type BlockDef = {
  level: Level;
  order: number;
  title: string;
  theoryMarkdown: string;
  theoryExamples: TheoryExample[];
  tasks: TaskDef[];
  datasets: SandboxDatasetDef[];
};
