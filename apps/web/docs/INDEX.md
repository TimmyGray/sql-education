# Web App — Docs Index

> **Summary:** Catalog of all `apps/web` documentation with a one-line summary and "read when" cue for each entry.
> For task-based routing, see the **[Context Map in AGENTS.md](../AGENTS.md#context-map--what-to-read-for-the-task-at-hand)**.

[← Project-wide docs index](../../../docs/INDEX.md)

---

## Architecture

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Overview](architecture/overview.md) | Routing tree, provider stack, auth session lifecycle, auth gates | Before any non-trivial change; setting context for the whole frontend |
| [Components](architecture/components.md) | Auth, shell, and study component map: responsibilities, props, constraints | Adding or modifying a specific UI component or page section |

## Guides

| Doc | Summary | Read when |
|-----|---------|-----------|
| [Development](guides/development.md) | Adding pages and components, making API calls, theming, env vars, testing | Day-to-day frontend development |

## Reference

| Doc | Summary | Read when |
|-----|---------|-----------|
| [API client](reference/api-client.md) | `request<T>()` helper, `ApiError`, `tokenStore`, `AuthContext` interface, `useAuth()` hook | Calling the backend or reading/mutating auth state |

---

*Each doc above starts with a header block and links back here.*
