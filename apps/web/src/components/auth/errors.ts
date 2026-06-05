import { ApiError } from "@/lib/api-client";

/**
 * Map a caught error to a user-facing message. Prefers the API's message, with
 * sensible fallbacks for the common auth status codes and network failures.
 */
export function toFriendlyMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return "Incorrect email or password.";
      case 409:
        return "That email is already registered. Try logging in instead.";
      case 429:
        return "Please wait a moment before requesting another code.";
      default:
        return err.message || fallback;
    }
  }
  if (err instanceof TypeError) {
    // fetch() rejects with a TypeError when the network/server is unreachable.
    return "Can't reach the server. Check your connection and try again.";
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

/** Narrow helper: is this an ApiError with the given status? */
export function isApiStatus(err: unknown, status: number): err is ApiError {
  return err instanceof ApiError && err.status === status;
}
