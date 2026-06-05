/**
 * Typed API client for the SQL Education backend.
 *
 * Responsibilities:
 *  - Point at NEXT_PUBLIC_API_URL.
 *  - Send `credentials: 'include'` so the httpOnly refresh cookie travels with
 *    requests (needed for the refresh flow).
 *  - Attach the in-memory Bearer access token (never persisted to storage).
 *  - Expose a generic, typed `request<T>()` helper.
 *  - Transparently recover from an expired access token: on a 401, perform a
 *    single-flight POST /auth/refresh and retry the original request once.
 *
 * Concrete endpoint wrappers live in `src/lib/api/*` (built on request<T>() +
 * @sql-edu/contracts schemas).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * In-memory access token store. Deliberately module-scoped (not localStorage)
 * so the access token never persists across reloads — the httpOnly refresh
 * cookie is the durable credential. AuthProvider keeps this in sync.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get(): string | null {
    return accessToken;
  },
  set(token: string | null): void {
    accessToken = token;
  },
  clear(): void {
    accessToken = null;
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialized automatically and given the right Content-Type. */
  json?: unknown;
  /**
   * Override the Bearer token for this call. Defaults to the in-memory
   * tokenStore value. Pass `null` to send no Authorization header.
   */
  accessToken?: string | null;
  /**
   * Internal: set on the retried request after a successful refresh so a second
   * 401 does not loop. Callers never set this.
   */
  _retried?: boolean;
}

/**
 * Hook invoked when a silent refresh fails (cookie missing/expired/invalid).
 * AuthProvider registers this to clear its user/token state so the UI logs out.
 * Kept as a registration seam to avoid a circular import with auth-context.
 */
type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler | null): void {
  onAuthFailure = handler;
}

/**
 * Hook invoked with fresh tokens after a successful background refresh, so
 * AuthProvider can sync its React state (the tokenStore is already updated).
 */
type TokenRefreshedHandler = (accessToken: string) => void;
let onTokenRefreshed: TokenRefreshedHandler | null = null;

export function setTokenRefreshedHandler(
  handler: TokenRefreshedHandler | null,
): void {
  onTokenRefreshed = handler;
}

/**
 * Single-flight refresh. While a refresh is in progress, concurrent 401s await
 * the same promise instead of stampeding /auth/refresh. Resolves to the new
 * access token on success, or `null` if the refresh failed (caller gives up).
 */
let refreshInFlight: Promise<string | null> | null = null;

interface RefreshResponseBody {
  accessToken?: unknown;
}

async function performRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    const data = (text ? safeJsonParse(text) : undefined) as
      | RefreshResponseBody
      | undefined;
    const nextToken = data?.accessToken;
    if (typeof nextToken !== "string" || nextToken.length === 0) {
      return null;
    }
    tokenStore.set(nextToken);
    onTokenRefreshed?.(nextToken);
    return nextToken;
  } catch {
    // Network error during refresh — treat as a failure; caller propagates.
    return null;
  }
}

/**
 * Returns the shared refresh promise, creating it if none is in flight. The
 * promise is cleared once settled so the next 401 (after a future expiry) can
 * start a new refresh.
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Generic request helper. Resolves to parsed JSON typed as T.
 *
 * `path` is relative to API_BASE_URL (e.g. "/health"). Callers should pin T to
 * a `@sql-edu/contracts` type and ideally parse the response with the matching
 * Zod schema.
 *
 * 401 handling: if the response is 401 and this is not already a retry and the
 * caller did not explicitly opt out of the bearer token, attempt a single
 * (shared) refresh and replay the request once with the new token.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, headers, _retried, ...rest } = options;
  const token =
    options.accessToken !== undefined ? options.accessToken : tokenStore.get();

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (token) {
    finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    // Always include credentials so the refresh cookie is sent/received.
    credentials: "include",
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  // 401 -> refresh -> retry (once, single-flight).
  // Skip when this call already opted out of auth (accessToken === null) or is
  // itself the retry, to avoid loops and to keep /auth/refresh itself simple.
  if (
    res.status === 401 &&
    !_retried &&
    options.accessToken !== null
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, {
        ...options,
        accessToken: newToken,
        _retried: true,
      });
    }
    // Refresh failed: clear auth so the app falls back to logged-out, then let
    // the original 401 propagate as an ApiError below.
    onAuthFailure?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : res.statusText || "Request failed";
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Convenience: the foundation's only real endpoint — the API health check. */
export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}
