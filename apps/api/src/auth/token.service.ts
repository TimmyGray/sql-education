import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { REFRESH_COOKIE } from "./auth.constants";

/**
 * `@nestjs/jwt` types `expiresIn` as `number | ms.StringValue`, but config
 * supplies a plain runtime string ("15m"/"7d"). jsonwebtoken accepts that
 * string at runtime, so we widen the field type for the sign options.
 */
type ExpiresIn = JwtSignOptions["expiresIn"];

/** Minimal user shape needed to mint tokens. */
export interface TokenUser {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE";
}

/** Access-token payload — MUST match the shared JwtAuthGuard's expectation. */
export interface AccessPayload {
  sub: string;
  email: string;
  status: "PENDING" | "ACTIVE";
}

/** Refresh-token payload. `jti` is tracked in Redis for rotation/revocation. */
export interface RefreshPayload {
  sub: string;
  jti: string;
}

/** Options bag for setting a cookie (subset of express' CookieOptions). */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

/** Minimal express Response surface for cookie handling (avoids an express dep). */
export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options?: CookieOptions): unknown;
}

/** Minimal express Request surface for reading cookies. */
export interface CookieRequest {
  cookies?: Record<string, string | undefined>;
}

/**
 * Signs/verifies JWTs and manages the refresh cookie.
 *
 * Access and refresh tokens are signed with DIFFERENT secrets, so a single
 * global JwtModule secret won't do — the secret is passed per-sign via sign
 * options. The verify side mirrors this.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Generate a fresh refresh-token id. */
  newJti(): string {
    return randomUUID();
  }

  /**
   * Sign the access token. Payload is EXACTLY `{ sub, email, status }` (the
   * shape the shared `JwtAuthGuard` decodes into `req.user`).
   */
  async signAccessToken(user: TokenUser): Promise<string> {
    const payload: AccessPayload = {
      sub: user.id,
      email: user.email,
      status: user.status,
    };
    this.logger.debug(`signAccessToken: user ${user.id}`);
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: (this.config.get<string>("JWT_ACCESS_TTL") ??
        "15m") as ExpiresIn,
    });
  }

  /** Sign the refresh token with payload `{ sub, jti }`. */
  async signRefreshToken(userId: string, jti: string): Promise<string> {
    const payload: RefreshPayload = { sub: userId, jti };
    this.logger.debug(`signRefreshToken: user ${userId}, jti ${jti}`);
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: (this.config.get<string>("JWT_REFRESH_TTL") ??
        "7d") as ExpiresIn,
    });
  }

  /** Verify a refresh token; throws if invalid/expired (caller maps to 401). */
  async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    return this.jwt.verifyAsync<RefreshPayload>(token, {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
    });
  }

  /** Access-token lifetime in whole seconds (for the AuthTokens body). */
  accessTtlSeconds(): number {
    return this.parseDurationSeconds(
      this.config.get<string>("JWT_ACCESS_TTL") ?? "15m",
    );
  }

  /** Refresh-token lifetime in whole seconds (cookie maxAge + Redis jti TTL). */
  refreshTtlSeconds(): number {
    return this.parseDurationSeconds(
      this.config.get<string>("JWT_REFRESH_TTL") ?? "7d",
    );
  }

  /** Build the AuthTokens response body for a freshly signed access token. */
  buildAuthTokens(accessToken: string): {
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
  } {
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.accessTtlSeconds(),
    };
  }

  /** Set the httpOnly refresh cookie on the response. */
  setRefreshCookie(res: CookieResponse, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
  }

  /** Clear the refresh cookie (logout / revocation). */
  clearRefreshCookie(res: CookieResponse): void {
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
  }

  /** Read the refresh token out of the request cookies (if present). */
  readRefreshCookie(req: CookieRequest): string | undefined {
    return req.cookies?.[REFRESH_COOKIE];
  }

  /** Cookie flags: httpOnly, sameSite lax, secure only in production. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: "/",
      maxAge: this.refreshTtlSeconds() * 1000,
    };
  }

  /**
   * Parse a JWT-style duration ("15m", "7d", "3600", "2h", "30s") to seconds.
   * A bare number is treated as seconds. Falls back to 0 on an unparseable
   * value (callers never pass one — config supplies sane defaults).
   */
  private parseDurationSeconds(value: string): number {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
    if (!match) return 0;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const factor =
      unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
    return amount * factor;
  }
}
