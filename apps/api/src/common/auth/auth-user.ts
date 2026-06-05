/**
 * Shared auth primitives used across ALL feature modules (auth, study, grading,
 * ai). Authored by the orchestrator so the backend waves can compile against a
 * stable contract without depending on each other's files.
 *
 * Convention: the access JWT is signed with `JWT_ACCESS_SECRET` and carries the
 * payload below. `AuthModule` (wave A) MUST sign access tokens with exactly this
 * shape; `JwtAuthGuard` (here) verifies them and populates `req.user`.
 */

/** Shape attached to `req.user` after `JwtAuthGuard` runs. */
export interface AuthUser {
  userId: string;
  email: string;
  status: "PENDING" | "ACTIVE";
}

/** Decoded access-token payload. `sub` is the user id. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  status: "PENDING" | "ACTIVE";
  iat?: number;
  exp?: number;
}

/** Minimal request shape the guards/decorator rely on (avoids an express types dep). */
export interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}
