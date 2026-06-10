/**
 * Typed auth endpoint wrappers over the generic `request<T>()` helper.
 *
 * Every wrapper pins its return type to a `@sql-edu/contracts` type and, where
 * practical, validates the response with the matching Zod schema so a contract
 * drift surfaces loudly at the boundary instead of silently downstream.
 *
 * The refresh token is an httpOnly cookie (sent automatically via
 * `credentials: "include"` in the client), so it never appears in any body.
 */

import {
  AuthTokensSchema,
  TestAccountTokensSchema,
  UserSchema,
  type AuthTokens,
  type TestAccountTokens,
  type User,
  type Register,
  type Login,
  type Activate,
  type ResendCode,
  type UpdateProfile,
} from "@sql-edu/contracts";
import { request } from "../api-client";

/** Plain `{ message }` ack returned by register / resend-code / logout. */
export interface MessageResponse {
  message: string;
}

/**
 * POST /auth/register — create a PENDING account.
 * 201 { message }; 409 if the email already exists (surfaces as ApiError 409).
 */
export function register(body: Register): Promise<MessageResponse> {
  return request<MessageResponse>("/auth/register", {
    method: "POST",
    json: body,
  });
}

/**
 * POST /auth/activate — exchange a 6-char code for tokens + refresh cookie.
 * 200 AuthTokens; 400 on a wrong/expired code.
 */
export async function activate(body: Activate): Promise<AuthTokens> {
  const data = await request<AuthTokens>("/auth/activate", {
    method: "POST",
    json: body,
  });
  return AuthTokensSchema.parse(data);
}

/**
 * POST /auth/login — exchange credentials for tokens + refresh cookie.
 * 200 AuthTokens; 403 PENDING (route to /activate); 401 bad credentials.
 */
export async function login(body: Login): Promise<AuthTokens> {
  const data = await request<AuthTokens>("/auth/login", {
    method: "POST",
    json: body,
  });
  return AuthTokensSchema.parse(data);
}

/**
 * POST /auth/test-account — create a temporary, pre-activated account (no
 * email sent) and log in as it. 200 {@link TestAccountTokens}; 429 if this IP
 * already created a test account within the last hour.
 */
export async function createTestAccount(): Promise<TestAccountTokens> {
  const data = await request<TestAccountTokens>("/auth/test-account", {
    method: "POST",
  });
  return TestAccountTokensSchema.parse(data);
}

/**
 * POST /auth/resend-code — re-send the activation email.
 * 200 { message }; 429 while inside the 60s cooldown (surfaces as ApiError 429).
 */
export function resendCode(body: ResendCode): Promise<MessageResponse> {
  return request<MessageResponse>("/auth/resend-code", {
    method: "POST",
    json: body,
  });
}

/**
 * POST /auth/refresh — rotate tokens using the httpOnly refresh cookie.
 * 200 AuthTokens (+ rotated cookie); 401 if the cookie is missing/invalid.
 *
 * Sent with `accessToken: null` so a stale/expired in-memory bearer is never
 * attached — the refresh cookie is the sole credential here.
 */
export async function refresh(): Promise<AuthTokens> {
  const data = await request<AuthTokens>("/auth/refresh", {
    method: "POST",
    accessToken: null,
  });
  return AuthTokensSchema.parse(data);
}

/**
 * POST /auth/logout — clear the refresh cookie server-side.
 * 200 { message }.
 */
export function logout(): Promise<MessageResponse> {
  return request<MessageResponse>("/auth/logout", { method: "POST" });
}

/**
 * GET /auth/me — current user (works for PENDING accounts too).
 * Requires a Bearer token (taken from the in-memory tokenStore by default).
 */
export async function getMe(): Promise<User> {
  const data = await request<User>("/auth/me");
  return UserSchema.parse(data);
}

/**
 * PATCH /users/me — update the profile (requires an ACTIVE Bearer token).
 * 200 User.
 */
export async function updateProfile(body: UpdateProfile): Promise<User> {
  const data = await request<User>("/users/me", {
    method: "PATCH",
    json: body,
  });
  return UserSchema.parse(data);
}
