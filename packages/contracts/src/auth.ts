import { z } from "zod";

/**
 * ---------------------------------------------------------------------------
 * Auth + current-user contracts.
 *
 * The refresh token is delivered/stored ONLY as an httpOnly cookie, so it is
 * never part of any request or response body. Bodies below carry the access
 * token only.
 * ---------------------------------------------------------------------------
 */

/** Account status (mirrors Prisma `UserStatus`). */
export const UserStatusSchema = z.enum(["PENDING", "ACTIVE"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/**
 * Registration body. `password` and `confirmPassword` must match (enforced via
 * refinement). `confirmPassword` itself has no length rule — only `password`
 * carries the min(8) requirement.
 */
export const RegisterSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type Register = z.infer<typeof RegisterSchema>;

/** Account activation via a 6-character confirmation code. */
export const ActivateSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
export type Activate = z.infer<typeof ActivateSchema>;

/** Login body. */
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type Login = z.infer<typeof LoginSchema>;

/** Request a fresh activation code be re-sent. */
export const ResendCodeSchema = z.object({
  email: z.string().email(),
});
export type ResendCode = z.infer<typeof ResendCodeSchema>;

/**
 * Tokens returned to the client on login/activate/refresh. Only the access
 * token is in the body; the refresh token lives in an httpOnly cookie.
 */
export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

/**
 * Tokens returned by `POST /auth/test-account`: the usual {@link AuthTokens}
 * plus the absolute expiry timestamp of the temporary account, so the client
 * can render a countdown without guessing the TTL.
 */
export const TestAccountTokensSchema = AuthTokensSchema.extend({
  testAccountExpiresAt: z.string(),
});
export type TestAccountTokens = z.infer<typeof TestAccountTokensSchema>;

/** Public representation of the authenticated user. */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  status: UserStatusSchema,
  createdAt: z.string(),
  /** True for temporary accounts created via `POST /auth/test-account`. */
  isTestAccount: z.boolean(),
  /** When a test account is auto-deleted; `null` for regular accounts. */
  testAccountExpiresAt: z.string().nullable(),
});
export type User = z.infer<typeof UserSchema>;

/** Profile update body. */
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
