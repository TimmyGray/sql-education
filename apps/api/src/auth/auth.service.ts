import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { randomInt } from "node:crypto";
import type { User as PrismaUser } from "@prisma/client";
import type {
  Activate,
  AuthTokens,
  Login,
  Register,
  ResendCode,
  User,
} from "@sql-edu/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { MailService } from "../mail/mail.service";
import { CookieResponse, TokenService } from "./token.service";
import {
  attemptsKey,
  CODE_LENGTH,
  CODE_TTL_SECONDS,
  codeKey,
  COOLDOWN_TTL_SECONDS,
  cooldownKey,
  MAX_CODE_ATTEMPTS,
  refreshJtiKey,
} from "./auth.constants";

/**
 * Core authentication logic: registration, activation, login, code resend,
 * refresh-token rotation, logout and current-user lookup.
 *
 * Side-effect dependencies (DB, Redis, Mail, token signing) are all injected so
 * the whole service can be unit-tested with fakes and zero real I/O.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly tokens: TokenService,
  ) {}

  // --- Registration --------------------------------------------------------

  /**
   * Create a PENDING user, provision an activation code (+ cooldown) in Redis,
   * and enqueue the welcome + code emails. One account per email — a duplicate
   * raises 409.
   */
  async register(dto: Register): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    this.logger.debug(`register: attempt for ${email}`);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      this.logger.debug(`register: ${email} already exists`);
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.user.create({
      data: { email, passwordHash, status: "PENDING", displayName: null },
    });

    const code = await this.provisionCode(email);

    // Enqueue both the welcome email and the activation-code email.
    await this.mail.enqueueWelcomeEmail(email);
    await this.mail.enqueueActivationCodeEmail(email, code);
    this.logger.log(`Registered ${email} (PENDING)`);
    return {
      message:
        "Registration successful. Check your email for the activation code.",
    };
  }

  // --- Activation ----------------------------------------------------------

  /**
   * Validate the activation code (case-insensitive, capped attempts). On
   * success flip the user to ACTIVE, drop the code, and issue tokens + refresh
   * cookie. Wrong/expired/missing code → 400.
   */
  async activate(dto: Activate, res: CookieResponse): Promise<AuthTokens> {
    const email = dto.email.toLowerCase();
    const key = codeKey(email);
    this.logger.debug(`activate: attempt for ${email}`);

    const stored = await this.redis.get(key);
    if (!stored) {
      this.logger.debug(`activate: no code on file for ${email}`);
      throw new BadRequestException(
        "Activation code is invalid or has expired",
      );
    }

    if (stored.toUpperCase() !== dto.code.trim().toUpperCase()) {
      const attempts = await this.redis.incr(attemptsKey(email));
      if (attempts >= MAX_CODE_ATTEMPTS) {
        // Too many wrong guesses — burn the code so it can't be brute-forced.
        await this.redis.del(key, attemptsKey(email));
        this.logger.warn(
          `activate: ${email} exceeded max code attempts (${MAX_CODE_ATTEMPTS})`,
        );
        throw new BadRequestException(
          "Too many invalid attempts. Request a new activation code.",
        );
      }
      this.logger.debug(
        `activate: wrong code for ${email} (attempt ${attempts}/${MAX_CODE_ATTEMPTS})`,
      );
      throw new BadRequestException(
        "Activation code is invalid or has expired",
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Code existed but user vanished — treat as invalid.
      await this.redis.del(key, attemptsKey(email));
      throw new BadRequestException(
        "Activation code is invalid or has expired",
      );
    }

    const activated =
      user.status === "ACTIVE"
        ? user
        : await this.prisma.user.update({
            where: { email },
            data: { status: "ACTIVE" },
          });

    await this.redis.del(key, attemptsKey(email), cooldownKey(email));

    this.logger.log(`Activated ${email}`);
    return this.issueSession(activated, res);
  }

  // --- Login ---------------------------------------------------------------

  /**
   * Verify credentials and issue a session. PENDING accounts get a 403 with a
   * `PENDING` error code so the UI can redirect to activation; bad credentials
   * get a generic 401.
   */
  async login(dto: Login, res: CookieResponse): Promise<AuthTokens> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Still run a verify against a dummy hash? Not required here; just 401.
      this.logger.debug(`login: no account for ${email}`);
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      this.logger.debug(`login: bad password for ${email}`);
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      this.logger.debug(`login: ${email} is not activated yet`);
      // Explicit body shape so the frontend can branch on error: "PENDING".
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        message: "Account not activated",
        error: "PENDING",
      });
    }

    this.logger.log(`Login succeeded for ${email}`);
    return this.issueSession(user, res);
  }

  // --- Resend code ---------------------------------------------------------

  /**
   * Re-issue an activation code, honouring the resend cooldown. Always returns
   * 200 (or 429 if cooled down) regardless of whether the email maps to a user,
   * to avoid account enumeration — but only actually regenerates/sends for a
   * real PENDING user.
   */
  async resendCode(dto: ResendCode): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();

    if (await this.redis.exists(cooldownKey(email))) {
      throw new HttpException(
        "Please wait before requesting another code",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === "PENDING") {
      const code = await this.provisionCode(email);
      await this.mail.enqueueActivationCodeEmail(email, code);
      this.logger.log(`Resent activation code to ${email}`);
    } else {
      // Set a cooldown anyway so timing can't distinguish existing accounts.
      await this.redis.setWithTtl(
        cooldownKey(email),
        "1",
        COOLDOWN_TTL_SECONDS,
      );
      this.logger.debug(
        `resendCode: no-op for ${email} (not a pending account)`,
      );
    }

    return {
      message: "If an account needs activation, a new code has been sent.",
    };
  }

  // --- Refresh -------------------------------------------------------------

  /**
   * Rotate the refresh token: verify the JWT, confirm its jti is still valid in
   * Redis, then delete the old jti and issue a brand-new access+refresh pair.
   * Any failure (bad JWT, revoked/unknown jti) → 401.
   */
  async refresh(
    refreshToken: string | undefined,
    res: CookieResponse,
  ): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    let payload: { sub: string; jti: string };
    try {
      payload = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      this.logger.debug("refresh: token failed verification");
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const ownerId = await this.redis.get(refreshJtiKey(payload.jti));
    if (!ownerId || ownerId !== payload.sub) {
      this.logger.debug(`refresh: jti ${payload.jti} is revoked or unknown`);
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      await this.redis.del(refreshJtiKey(payload.jti));
      this.logger.debug(`refresh: user ${payload.sub} no longer exists`);
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    // Rotate: invalidate the presented jti before minting the next one.
    await this.redis.del(refreshJtiKey(payload.jti));
    this.logger.debug(`refresh: rotated session for ${user.email}`);
    return this.issueSession(user, res);
  }

  // --- Logout --------------------------------------------------------------

  /**
   * Revoke the presented refresh jti (if any) and clear the cookie. Never
   * errors on a missing/garbage cookie — logout is idempotent.
   */
  async logout(
    refreshToken: string | undefined,
    res: CookieResponse,
  ): Promise<{ message: string }> {
    if (refreshToken) {
      try {
        const payload = await this.tokens.verifyRefreshToken(refreshToken);
        await this.redis.del(refreshJtiKey(payload.jti));
        this.logger.debug(`logout: revoked jti ${payload.jti}`);
      } catch {
        // Ignore — token already invalid/expired; cookie clear below suffices.
        this.logger.debug("logout: refresh token already invalid/expired");
      }
    }
    this.tokens.clearRefreshCookie(res);
    return { message: "Logged out" };
  }

  // --- Current user --------------------------------------------------------

  /** Look up a user by id and map to the public User shape (works for PENDING). */
  async getMe(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    return this.toPublicUser(user);
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Issue a full session: sign access + refresh, persist the refresh jti in
   * Redis, set the cookie, and return the AuthTokens body.
   */
  private async issueSession(
    user: PrismaUser,
    res: CookieResponse,
  ): Promise<AuthTokens> {
    const accessToken = await this.tokens.signAccessToken({
      id: user.id,
      email: user.email,
      status: user.status,
    });

    const jti = this.tokens.newJti();
    const refreshToken = await this.tokens.signRefreshToken(user.id, jti);
    // The Redis jti record outlives the token by exactly its lifetime, so a
    // revoked/rotated jti is always caught while the JWT could still verify.
    await this.redis.setWithTtl(
      refreshJtiKey(jti),
      user.id,
      this.tokens.refreshTtlSeconds(),
    );
    this.tokens.setRefreshCookie(res, refreshToken);

    return this.tokens.buildAuthTokens(accessToken);
  }

  /**
   * Generate + store a fresh activation code, reset the attempt counter, and
   * (re)arm the resend cooldown. Returns the plaintext code so the caller can
   * enqueue exactly one code email (avoids a double-send on resend).
   */
  private async provisionCode(email: string): Promise<string> {
    const code = this.generateCode();
    await this.redis.setWithTtl(codeKey(email), code, CODE_TTL_SECONDS);
    await this.redis.del(attemptsKey(email));
    await this.redis.setWithTtl(cooldownKey(email), "1", COOLDOWN_TTL_SECONDS);
    return code;
  }

  /** A zero-padded numeric code of CODE_LENGTH digits. */
  private generateCode(): string {
    const max = 10 ** CODE_LENGTH;
    return String(randomInt(0, max)).padStart(CODE_LENGTH, "0");
  }

  /** Map a Prisma user to the public {@link User} contract shape. */
  private toPublicUser(user: PrismaUser): User {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
