/** Minimal request surface needed to determine the client IP (avoids an express dep). */
export interface ClientIpRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Best-effort client IP for the test-account rate limit. Prefers Express's
 * `req.ip` (honours `app.set('trust proxy', ...)`), falls back to the first
 * `X-Forwarded-For` entry, then the raw socket address.
 */
export function getClientIp(req: ClientIpRequest): string {
  if (req.ip) return req.ip;

  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  return req.socket?.remoteAddress ?? "unknown";
}
