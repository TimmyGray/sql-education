/**
 * Centralised auth constants: Redis key builders + TTLs and the refresh-cookie
 * definition. Keeping them here keeps AuthService readable and the tests honest
 * (they assert against the same builders).
 */

/** httpOnly cookie name carrying the refresh token. */
export const REFRESH_COOKIE = "refresh_token";

/** Activation code length (numeric). */
export const CODE_LENGTH = 6;

/** Activation code TTL: 15 minutes. */
export const CODE_TTL_SECONDS = 900;

/** Resend cooldown TTL: 60 seconds. */
export const COOLDOWN_TTL_SECONDS = 60;

/** Max verification attempts before a code is invalidated. */
export const MAX_CODE_ATTEMPTS = 5;

/** Redis key holding the activation code for an email. */
export const codeKey = (email: string): string =>
  `activation:code:${email.toLowerCase()}`;

/** Redis key counting failed verification attempts for an email. */
export const attemptsKey = (email: string): string =>
  `activation:attempts:${email.toLowerCase()}`;

/** Redis key enforcing the resend cooldown for an email. */
export const cooldownKey = (email: string): string =>
  `activation:cooldown:${email.toLowerCase()}`;

/** Redis key mapping a refresh-token jti => userId (presence == valid). */
export const refreshJtiKey = (jti: string): string => `refresh:jti:${jti}`;
