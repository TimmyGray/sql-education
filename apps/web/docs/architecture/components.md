# Component Map

> **Summary:** Responsibilities, key props, and constraints for every significant component in `apps/web/src/`.
> **Read this when:** Adding or modifying a specific UI area — find the component here, then read the source file.
> **Audience:** both
> **Related:** [Architecture overview](overview.md) · [API client reference](../reference/api-client.md)

[← Back to web docs index](../INDEX.md)

---

## Shell components

### `AppShell` {#app-shell}

`src/components/AppShell.tsx`

Composes `<RequireAuth>` + `<AppNav>` + `<Box component="main">`. Used as the layout in `app/study/layout.tsx` to protect the dashboard, study, and (via its own inline gate) the account page. Contains no domain logic.

### `AppNav` {#app-nav}

`src/components/AppNav.tsx`

Sticky, frosted-glass top bar. Links: **Dashboard** and **Account**. User identity shown as an avatar + display name (falls back to email). Collapses to a hamburger drawer (`<Drawer anchor="left">`) on `xs` screens. Account dropdown (>= `sm`) exposes Profile and Log out. Logout calls `useAuth().logout()` then routes to `/login`.

Nav links are defined in the `NAV_LINKS` constant — extend it there, not inline.

### `RequireAuth` / `RedirectIfAuthed` {#auth-gates}

`src/components/RequireAuth.tsx`

See [Auth gates in the overview](overview.md#auth-gates) for redirect rules.

### `TestAccountBanner` {#test-account-banner}

`src/components/TestAccountBanner.tsx`

Mounted in `<AppShell>` (above `<AppNav>`), so it appears on every protected page. Renders `null` unless `user.isTestAccount`. Otherwise shows a persistent `info` `<Alert>` with a live `m:ss` countdown to `user.testAccountExpiresAt`. When the countdown reaches zero it calls `useAuth().logout()` and redirects to `/login?testAccountExpired=1` — the account has been (or is about to be) deleted server-side by `TestAccountCleanupService`.

---

## Auth components (`src/components/auth/`)

| Component | Purpose |
|-----------|---------|
| `AuthShell` | Centered card layout used by all auth pages (login / register / activate) |
| `BrandMark` | SQL-Edu logo mark, used in AppNav and AuthShell. Props: `size: "sm" | "md"` |
| `CodeInput` | 6-character OTP input for the activation code. Controlled: `value`, `onChange` |
| `PasswordField` | MUI `TextField` with show/hide toggle. Controlled via react-hook-form `register()` |
| `TestAccountButton` | "Try a test account" button on the login/register forms. Props: `{ onError: (message: string \| null) => void }`. Calls `useAuth().startTestAccount()` and routes to `/dashboard`; surfaces the `429 TEST_ACCOUNT_RATE_LIMITED` body (one per IP per hour) as a friendly message via `onError` |
| `FullScreenLoader` | Full-viewport centered `<CircularProgress>`, shown during auth bootstrap |
| `errors.ts` | `toFriendlyMessage(err)` — converts `ApiError` status codes to human strings |

---

## Study components (`src/components/study/`)

### `DashboardView` {#dashboardview}

`src/components/study/DashboardView.tsx`

Level selector + block grid. Fetches `GET /content/dashboard` via React Query (`queryKey: ["dashboard"]`). Local `level` state drives which `LevelProgress` entry is displayed. Block navigation goes through `router.push(\`/study/\${block.level}/\${block.id}\`)`.

**Level order and labels** come from `src/components/study/types.ts`:
- `LEVEL_ORDER = ["NOVICE", "JUNIOR", "MIDDLE"]`
- `LEVEL_LABELS: Record<Level, string>`

Sub-components used: `<BlockCard>` (per block card), `<Skeleton>` grid (loading state).

### `BlockCard`

`src/components/study/BlockCard.tsx`

Single block card in the dashboard grid. Shows title, order number, status chip, and task count. LOCKED blocks do not navigate — the click handler is suppressed. Derives display state from `BlockSummary` (from `@sql-edu/contracts`).

### `StudyView` {#studyview}

`src/components/study/StudyView.tsx`

The main learning view for a single block. Props: `{ blockId: string }`.

Fetches `GET /content/blocks/:blockId` via React Query (`queryKey: ["block", blockId]`). A 403 response is surfaced as a "locked block" warning (not a generic error).

Layout (responsive grid):
- **Left column (sticky on desktop):** `<TheoryPanel>` — theory markdown + worked examples.
- **Right column:** List of `<TaskCard>` components, each driven by the task data from the block. A progress bar tracks resolved tasks (COMPLETED + SKIPPED).
- **Block-complete banner:** Shown when all tasks are resolved (covers both COMPLETED and SKIPPED).
- **AI tutor FAB:** Fixed bottom-right button; opens `<AiTutorDrawer>`.

Per-task status is tracked in local state (`statuses: Record<taskId, TaskStatus>`), seeded from the fetched data, updated via `onStatusChange` callbacks from `<TaskCard>`.

`<SqlEditor>` is passed to `<TaskCard>` as a **render prop** (`editorSlot`) so the heavy CodeMirror import stays in `StudyView` and can be swapped in tests.

### `TaskCard` {#taskcard}

`src/components/study/TaskCard.tsx`

Props: `{ task: TaskPublic, index: number, onStatusChange, editorSlot }`.

Renders one graded SQL task: prompt, dataset schema panel, SQL editor (injected via `editorSlot`), submit button, hint toggle, reveal-answer flow.

State machine:
- **Submit:** calls `POST /study/tasks/:taskId/submit` → `setResult()` → `updateStatus()`.
- **Reveal:** opens a confirm dialog first; on confirm calls `POST /study/tasks/:taskId/reveal` → shows reference query → marks task SKIPPED (unless already COMPLETED).
- **Hint:** toggle-revealed `task.hint` in a `<Collapse>`.

Result rendering (`SubmitResultView`):
- `correct: true` → success alert + result table.
- `errorType: WRONG_RESULT` → warning alert + user's returned rows.
- Other error types → error alert with the server message.

Error type labels are resolved by `labelForErrorType()` at the bottom of the file.

### `SqlEditor`

`src/components/study/SqlEditor.tsx`

Thin wrapper around `@uiw/react-codemirror` with SQL language support, dark theme, and a fixed height. Props: `{ value, onChange, disabled, ariaLabel }`. No logic — pure editor shell.

### `TheoryPanel`

`src/components/study/TheoryPanel.tsx`

Renders `theoryMarkdown` (via `<Markdown>`) and `theoryExamples` (via `<CodeBlock>` + explanation text). Examples are coerced from `unknown[]` by `coerceTheoryExamples()` in `types.ts`.

### `DatasetSchemaView`

`src/components/study/DatasetSchemaView.tsx`

Renders the queryable table schema for a task — table names, column names, and types. Props: `{ tables: DatasetSchema }`.

### `ResultTable`

`src/components/study/ResultTable.tsx`

Scrollable MUI table for query results. Props: `{ columns: string[], rows: unknown[][] }`.

### `StatusChips`

`src/components/study/StatusChips.tsx`

Exports `<BlockStatusChip>` and `<TaskStatusChip>`. Maps `BlockStatus` / `TaskStatus` enum values to MUI `<Chip>` color and label. Props: `{ status, size? }`.

### `Markdown`

`src/components/study/Markdown.tsx`

Renders Markdown strings to HTML safely. Uses a restricted allow-list of tags.

### `CodeBlock`

`src/components/study/CodeBlock.tsx`

Monospace code display with syntax highlighting (no interactive editing). Used for worked examples and the revealed reference query.

### `AiTutorDrawer` {#ai-tutor-drawer}

`src/components/study/AiTutorDrawer.tsx`

Props: `{ open, onClose, blockId, initialRemaining }`.

Right-side `<Drawer>` (full-width on mobile). Maintains a local `messages: ChatMessage[]` list, a `remaining` counter, and a `streamingText` string for in-flight tokens. On each send, calls `askAiStream` (see `src/lib/api/ai.ts`) which opens `POST /ai/blocks/:blockId/ask/stream` as an SSE connection.

**Streaming behaviour:**
- While the LLM generates, each `token` event appends to `streamingText`, which is rendered in a live "thinking" bubble.
- On the `done` event, the final `done.reply` (sanitised) is committed as a `ChatMessage`; `streamingText` is cleared.
- An `AbortController` is created per send and aborted when the drawer closes or unmounts, cancelling the in-flight stream.

**Constraints:**
- `remaining ≤ 0` disables the input. The server also enforces the quota and returns it via the `done` event.
- `refused: true` replies are styled in a dashed warning bubble with an explanatory caption.
- `error: true` bubbles are transient failure states (network error / LLM unavailable) shown inline.
- The conversation is local state — it resets when the drawer unmounts (navigating away and back starts fresh).

### `types.ts` (study)

`src/components/study/types.ts`

Defines local presentational types:
- `TheoryExample` — one worked example (`{ title?, sql, explanation }`).
- `ChatMessage` — AI tutor chat message (`{ id, role, text, refused?, error? }`).
- `LEVEL_LABELS` / `LEVEL_ORDER` — single source for level display and ordering.
- `coerceTheoryExamples(input)` — defensive coercion from `unknown[]` to `TheoryExample[]`.

---

*Next: [Development guide](../guides/development.md) for day-to-day patterns.*
