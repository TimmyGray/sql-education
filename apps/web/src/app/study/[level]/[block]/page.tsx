import { StudyView } from "@/components/study/StudyView";

/**
 * Study route — theory, tasks (CodeMirror SQL editor), and the AI tutor for a
 * single block. The `[block]` route param is the block id; `[level]` is carried
 * for a clean URL but the content is keyed by id.
 *
 * The orchestrator wraps this page with AppNav + RequireAuth at integration;
 * this component renders page CONTENT only.
 */
export default async function StudyBlockPage({
  params,
}: {
  params: Promise<{ level: string; block: string }>;
}): Promise<React.JSX.Element> {
  const { block } = await params;
  return <StudyView blockId={block} />;
}
