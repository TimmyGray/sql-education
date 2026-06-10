import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";

// argon2 is mocked so no real (CPU-heavy, native) hashing/verifying runs.
jest.mock("argon2", () => ({
  hash: jest.fn(async (pw: string) => `hashed:${pw}`),
  verify: jest.fn(async (hash: string, pw: string) => hash === `hashed:${pw}`),
}));
import * as argon2 from "argon2";

import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { MailService } from "../mail/mail.service";
import { TokenService, CookieResponse } from "./token.service";
import {
  attemptsKey,
  codeKey,
  cooldownKey,
  refreshJtiKey,
  TEST_ACCOUNT_IP_COOLDOWN_SECONDS,
  TEST_ACCOUNT_TTL_SECONDS,
  testAccountIpKey,
} from "./auth.constants";

type PrismaUserMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const ACTIVE_USER = {
  id: "user-1",
  email: "user@test.com",
  passwordHash: "hashed:secretpw",
  status: "ACTIVE" as const,
  displayName: "Test",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  isTestAccount: false,
  testAccountExpiresAt: null as Date | null,
};
const PENDING_USER = { ...ACTIVE_USER, status: "PENDING" as const };

describe("AuthService", () => {
  let prismaUser: PrismaUserMock;
  let prisma: PrismaService;
  let redis: jest.Mocked<
    Pick<RedisService, "get" | "setWithTtl" | "del" | "incr" | "exists" | "ttl">
  >;
  let mail: jest.Mocked<
    Pick<MailService, "enqueueWelcomeEmail" | "enqueueActivationCodeEmail">
  >;
  let tokens: jest.Mocked<
    Pick<
      TokenService,
      | "signAccessToken"
      | "signRefreshToken"
      | "verifyRefreshToken"
      | "newJti"
      | "refreshTtlSeconds"
      | "setRefreshCookie"
      | "clearRefreshCookie"
      | "buildAuthTokens"
    >
  >;
  let res: CookieResponse;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    prismaUser = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = { user: prismaUser } as unknown as PrismaService;

    redis = {
      get: jest.fn().mockResolvedValue(null),
      setWithTtl: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(false),
      ttl: jest.fn().mockResolvedValue(-2),
    };

    mail = {
      enqueueWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      enqueueActivationCodeEmail: jest.fn().mockResolvedValue(undefined),
    };

    tokens = {
      signAccessToken: jest.fn().mockResolvedValue("access.jwt"),
      signRefreshToken: jest.fn().mockResolvedValue("refresh.jwt"),
      verifyRefreshToken: jest.fn(),
      newJti: jest.fn().mockReturnValue("jti-new"),
      refreshTtlSeconds: jest.fn().mockReturnValue(604800),
      setRefreshCookie: jest.fn(),
      clearRefreshCookie: jest.fn(),
      buildAuthTokens: jest.fn().mockReturnValue({
        accessToken: "access.jwt",
        tokenType: "Bearer",
        expiresIn: 900,
      }),
    };

    res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as CookieResponse;

    service = new AuthService(
      prisma,
      redis as unknown as RedisService,
      mail as unknown as MailService,
      tokens as unknown as TokenService,
    );
  });

  // --- register ------------------------------------------------------------
  describe("register", () => {
    const dto = {
      email: "New@Test.com",
      password: "secretpw1",
      confirmPassword: "secretpw1",
    };

    it("hashes the password, creates a PENDING user, stores code+cooldown, enqueues emails", async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      prismaUser.create.mockResolvedValue({ ...PENDING_USER });

      const result = await service.register(dto);

      expect(argon2.hash).toHaveBeenCalledWith("secretpw1");
      expect(prismaUser.create).toHaveBeenCalledWith({
        data: {
          email: "new@test.com",
          passwordHash: "hashed:secretpw1",
          status: "PENDING",
          displayName: null,
        },
      });
      // Code stored with 900s TTL, cooldown with 60s TTL.
      expect(redis.setWithTtl).toHaveBeenCalledWith(
        codeKey("new@test.com"),
        expect.stringMatching(/^\d{6}$/),
        900,
      );
      expect(redis.setWithTtl).toHaveBeenCalledWith(
        cooldownKey("new@test.com"),
        "1",
        60,
      );
      // Both emails enqueued.
      expect(mail.enqueueWelcomeEmail).toHaveBeenCalledWith("new@test.com");
      expect(mail.enqueueActivationCodeEmail).toHaveBeenCalledWith(
        "new@test.com",
        expect.stringMatching(/^\d{6}$/),
      );
      expect(result.message).toMatch(/registration successful/i);
    });

    it("rejects a duplicate email with 409", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...ACTIVE_USER });
      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaUser.create).not.toHaveBeenCalled();
    });
  });

  // --- activate ------------------------------------------------------------
  describe("activate", () => {
    it("activates on the correct code, flips ACTIVE, clears keys, issues tokens", async () => {
      redis.get.mockResolvedValue("ABC123"); // stored code
      prismaUser.findUnique.mockResolvedValue({ ...PENDING_USER });
      prismaUser.update.mockResolvedValue({ ...ACTIVE_USER });

      const out = await service.activate(
        { email: "User@test.com", code: "abc123" }, // case-insensitive
        res,
      );

      expect(prismaUser.update).toHaveBeenCalledWith({
        where: { email: "user@test.com" },
        data: { status: "ACTIVE" },
      });
      expect(redis.del).toHaveBeenCalledWith(
        codeKey("user@test.com"),
        attemptsKey("user@test.com"),
        cooldownKey("user@test.com"),
      );
      expect(tokens.signAccessToken).toHaveBeenCalled();
      expect(tokens.setRefreshCookie).toHaveBeenCalledWith(res, "refresh.jwt");
      expect(out).toEqual({
        accessToken: "access.jwt",
        tokenType: "Bearer",
        expiresIn: 900,
      });
    });

    it("rejects a wrong code with 400 and increments attempts", async () => {
      redis.get.mockResolvedValue("999999");
      redis.incr.mockResolvedValue(1);

      await expect(
        service.activate({ email: "user@test.com", code: "000000" }, res),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(redis.incr).toHaveBeenCalledWith(attemptsKey("user@test.com"));
      expect(prismaUser.update).not.toHaveBeenCalled();
    });

    it("burns the code after too many attempts", async () => {
      redis.get.mockResolvedValue("999999");
      redis.incr.mockResolvedValue(5); // reaches MAX_CODE_ATTEMPTS

      await expect(
        service.activate({ email: "user@test.com", code: "000000" }, res),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(redis.del).toHaveBeenCalledWith(
        codeKey("user@test.com"),
        attemptsKey("user@test.com"),
      );
    });

    it("rejects an expired/missing code with 400", async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.activate({ email: "user@test.com", code: "123456" }, res),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // --- login ---------------------------------------------------------------
  describe("login", () => {
    it("returns AuthTokens on valid credentials", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...ACTIVE_USER });

      const out = await service.login(
        { email: "User@test.com", password: "secretpw" },
        res,
      );

      expect(argon2.verify).toHaveBeenCalledWith("hashed:secretpw", "secretpw");
      expect(tokens.setRefreshCookie).toHaveBeenCalled();
      expect(out.accessToken).toBe("access.jwt");
      expect(out.tokenType).toBe("Bearer");
    });

    it("returns 403 with PENDING body for an unactivated account", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...PENDING_USER });

      await expect(
        service.login({ email: "user@test.com", password: "secretpw" }, res),
      ).rejects.toMatchObject({
        // ForbiddenException carrying the exact body shape the UI branches on.
        response: {
          statusCode: 403,
          message: "Account not activated",
          error: "PENDING",
        },
      });
      const err = await service
        .login({ email: "user@test.com", password: "secretpw" }, res)
        .catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
    });

    it("returns 401 on a bad password", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...ACTIVE_USER });
      await expect(
        service.login({ email: "user@test.com", password: "wrong" }, res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("returns 401 when the user does not exist", async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@test.com", password: "x" }, res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // --- createTestAccount -----------------------------------------------------
  describe("createTestAccount", () => {
    const ip = "203.0.113.7";

    it("creates an ACTIVE test account, arms the IP cooldown, and issues a session", async () => {
      prismaUser.create.mockResolvedValue({
        ...ACTIVE_USER,
        id: "test-user-1",
        email: "test-abc@test-account.sql-edu.local",
        isTestAccount: true,
        testAccountExpiresAt: new Date("2025-01-01T00:30:00.000Z"),
      });

      const out = await service.createTestAccount(ip, res);

      expect(redis.exists).toHaveBeenCalledWith(testAccountIpKey(ip));
      expect(prismaUser.create).toHaveBeenCalledWith({
        data: {
          email: expect.stringMatching(/^test-.+@test-account\.sql-edu\.local$/),
          passwordHash: expect.any(String),
          status: "ACTIVE",
          displayName: "Test User",
          isTestAccount: true,
          testAccountExpiresAt: expect.any(Date),
        },
      });
      // IP cooldown armed for TEST_ACCOUNT_IP_COOLDOWN_SECONDS (1 hour).
      expect(redis.setWithTtl).toHaveBeenCalledWith(
        testAccountIpKey(ip),
        "1",
        TEST_ACCOUNT_IP_COOLDOWN_SECONDS,
      );
      // Session issued like any other login.
      expect(tokens.setRefreshCookie).toHaveBeenCalledWith(res, "refresh.jwt");
      expect(out).toEqual({
        accessToken: "access.jwt",
        tokenType: "Bearer",
        expiresIn: 900,
        testAccountExpiresAt: expect.any(String),
      });

      // The account expires ~TEST_ACCOUNT_TTL_SECONDS (30 min) from now, both
      // in the persisted row and in the returned timestamp.
      const createdData = prismaUser.create.mock.calls[0][0].data;
      const persistedExpiry = (createdData.testAccountExpiresAt as Date).getTime();
      const returnedExpiry = new Date(out.testAccountExpiresAt).getTime();
      const now = Date.now();
      for (const expiresAt of [persistedExpiry, returnedExpiry]) {
        expect(expiresAt - now).toBeGreaterThan((TEST_ACCOUNT_TTL_SECONDS - 5) * 1000);
        expect(expiresAt - now).toBeLessThanOrEqual(TEST_ACCOUNT_TTL_SECONDS * 1000);
      }
    });

    it("rejects with 429 when the IP already created a test account this hour", async () => {
      redis.exists.mockResolvedValue(true);

      await expect(service.createTestAccount(ip, res)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: expect.objectContaining({ error: "TEST_ACCOUNT_RATE_LIMITED" }),
      });
      expect(prismaUser.create).not.toHaveBeenCalled();
      expect(redis.setWithTtl).not.toHaveBeenCalledWith(
        testAccountIpKey(ip),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // --- resend-code ---------------------------------------------------------
  describe("resendCode", () => {
    it("returns 429 while the cooldown is active", async () => {
      redis.exists.mockResolvedValue(true);
      const err = await service
        .resendCode({ email: "user@test.com" })
        .catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    });

    it("re-issues a code + enqueues email for a PENDING user", async () => {
      redis.exists.mockResolvedValue(false);
      prismaUser.findUnique.mockResolvedValue({ ...PENDING_USER });

      const out = await service.resendCode({ email: "User@test.com" });

      expect(redis.setWithTtl).toHaveBeenCalledWith(
        codeKey("user@test.com"),
        expect.stringMatching(/^\d{6}$/),
        900,
      );
      // The freshly generated code (same value stored in Redis) is emailed once.
      const storedCode = redis.setWithTtl.mock.calls.find(
        (c) => c[0] === codeKey("user@test.com"),
      )?.[1];
      expect(mail.enqueueActivationCodeEmail).toHaveBeenCalledTimes(1);
      expect(mail.enqueueActivationCodeEmail).toHaveBeenCalledWith(
        "user@test.com",
        storedCode,
      );
      expect(out.message).toMatch(/code has been sent/i);
    });

    it("still 200s (no email) for an unknown/ACTIVE account but sets a cooldown", async () => {
      redis.exists.mockResolvedValue(false);
      prismaUser.findUnique.mockResolvedValue(null);

      const out = await service.resendCode({ email: "ghost@test.com" });

      expect(mail.enqueueActivationCodeEmail).not.toHaveBeenCalled();
      expect(redis.setWithTtl).toHaveBeenCalledWith(
        cooldownKey("ghost@test.com"),
        "1",
        60,
      );
      expect(out.message).toMatch(/code has been sent/i);
    });
  });

  // --- refresh -------------------------------------------------------------
  describe("refresh", () => {
    it("rotates a valid jti: deletes old, issues new tokens", async () => {
      tokens.verifyRefreshToken.mockResolvedValue({ sub: "user-1", jti: "old-jti" });
      redis.get.mockResolvedValue("user-1"); // jti owner matches
      prismaUser.findUnique.mockResolvedValue({ ...ACTIVE_USER });

      const out = await service.refresh("refresh.jwt", res);

      expect(redis.del).toHaveBeenCalledWith(refreshJtiKey("old-jti"));
      // New jti persisted on issue.
      expect(redis.setWithTtl).toHaveBeenCalledWith(
        refreshJtiKey("jti-new"),
        "user-1",
        604800,
      );
      expect(tokens.setRefreshCookie).toHaveBeenCalledWith(res, "refresh.jwt");
      expect(out.accessToken).toBe("access.jwt");
    });

    it("rejects when no cookie is present (401)", async () => {
      await expect(service.refresh(undefined, res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects an invalid JWT (401)", async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error("bad sig"));
      await expect(service.refresh("garbage", res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects a revoked/unknown jti (401)", async () => {
      tokens.verifyRefreshToken.mockResolvedValue({ sub: "user-1", jti: "old-jti" });
      redis.get.mockResolvedValue(null); // jti not in Redis
      await expect(service.refresh("refresh.jwt", res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects when the jti owner does not match the token subject", async () => {
      tokens.verifyRefreshToken.mockResolvedValue({ sub: "user-1", jti: "old-jti" });
      redis.get.mockResolvedValue("someone-else");
      await expect(service.refresh("refresh.jwt", res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // --- logout --------------------------------------------------------------
  describe("logout", () => {
    it("revokes the jti and clears the cookie", async () => {
      tokens.verifyRefreshToken.mockResolvedValue({ sub: "user-1", jti: "jti-x" });

      const out = await service.logout("refresh.jwt", res);

      expect(redis.del).toHaveBeenCalledWith(refreshJtiKey("jti-x"));
      expect(tokens.clearRefreshCookie).toHaveBeenCalledWith(res);
      expect(out.message).toMatch(/logged out/i);
    });

    it("is idempotent when no/invalid cookie is present", async () => {
      const out = await service.logout(undefined, res);
      expect(redis.del).not.toHaveBeenCalled();
      expect(tokens.clearRefreshCookie).toHaveBeenCalledWith(res);
      expect(out.message).toMatch(/logged out/i);
    });

    it("clears the cookie even if the token fails to verify", async () => {
      tokens.verifyRefreshToken.mockRejectedValue(new Error("expired"));
      await service.logout("expired.jwt", res);
      expect(tokens.clearRefreshCookie).toHaveBeenCalledWith(res);
    });
  });

  // --- getMe ---------------------------------------------------------------
  describe("getMe", () => {
    it("maps a Prisma user to the public User shape (createdAt as ISO)", async () => {
      prismaUser.findUnique.mockResolvedValue({ ...PENDING_USER });
      const me = await service.getMe("user-1");
      expect(me).toEqual({
        id: "user-1",
        email: "user@test.com",
        displayName: "Test",
        status: "PENDING",
        createdAt: "2025-01-01T00:00:00.000Z",
        isTestAccount: false,
        testAccountExpiresAt: null,
      });
    });

    it("throws 401 if the user no longer exists", async () => {
      prismaUser.findUnique.mockResolvedValue(null);
      await expect(service.getMe("gone")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // --- access token payload contract --------------------------------------
  it("signs the access token via the user's {id,email,status} (payload contract)", async () => {
    prismaUser.findUnique.mockResolvedValue({ ...ACTIVE_USER });
    await service.login({ email: "user@test.com", password: "secretpw" }, res);
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      id: "user-1",
      email: "user@test.com",
      status: "ACTIVE",
    });
  });
});
