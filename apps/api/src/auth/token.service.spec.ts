import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { TokenService, CookieResponse } from "./token.service";
import { REFRESH_COOKIE } from "./auth.constants";

/**
 * TokenService unit tests. The JwtService is a fake so we can assert EXACTLY
 * what payload/options get signed — the access-token shape is a hard contract
 * with the shared JwtAuthGuard.
 */
describe("TokenService", () => {
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let service: TokenService;

  const configValues: Record<string, string> = {
    JWT_ACCESS_SECRET: "access-secret",
    JWT_REFRESH_SECRET: "refresh-secret",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    NODE_ENV: "test",
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  beforeEach(() => {
    jwt = {
      signAsync: jest.fn().mockResolvedValue("signed.jwt.token"),
      verifyAsync: jest.fn().mockResolvedValue({ sub: "u1", jti: "j1" }),
    };
    service = new TokenService(jwt as unknown as JwtService, config);
  });

  it("signs the access token with payload {sub,email,status} and access secret/ttl", async () => {
    await service.signAccessToken({
      id: "user-123",
      email: "a@test.com",
      status: "ACTIVE",
    });

    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
    const [payload, options] = jwt.signAsync.mock.calls[0];
    // Payload MUST be exactly these three keys.
    expect(payload).toEqual({
      sub: "user-123",
      email: "a@test.com",
      status: "ACTIVE",
    });
    expect(Object.keys(payload).sort()).toEqual(["email", "status", "sub"]);
    expect(options).toMatchObject({
      secret: "access-secret",
      expiresIn: "15m",
    });
  });

  it("signs the refresh token with payload {sub,jti} and refresh secret/ttl", async () => {
    await service.signRefreshToken("user-123", "jti-abc");

    const [payload, options] = jwt.signAsync.mock.calls[0];
    expect(payload).toEqual({ sub: "user-123", jti: "jti-abc" });
    expect(options).toMatchObject({
      secret: "refresh-secret",
      expiresIn: "7d",
    });
  });

  it("verifyRefreshToken uses the refresh secret", async () => {
    await service.verifyRefreshToken("tok");
    expect(jwt.verifyAsync).toHaveBeenCalledWith("tok", {
      secret: "refresh-secret",
    });
  });

  it("computes access TTL seconds from the configured duration", () => {
    expect(service.accessTtlSeconds()).toBe(900); // 15m
    expect(service.refreshTtlSeconds()).toBe(604800); // 7d
  });

  it("parses second/hour units and bare-number (seconds) durations", () => {
    const withTtl = (ttl: string) =>
      new TokenService(jwt as unknown as JwtService, {
        get: jest.fn((key: string) =>
          key === "JWT_ACCESS_TTL" ? ttl : configValues[key],
        ),
      } as unknown as ConfigService);

    expect(withTtl("30s").accessTtlSeconds()).toBe(30);
    expect(withTtl("2h").accessTtlSeconds()).toBe(7200);
    expect(withTtl("3600").accessTtlSeconds()).toBe(3600);
  });

  it("falls back to 0 for an unparseable duration", () => {
    const svc = new TokenService(jwt as unknown as JwtService, {
      get: jest.fn((key: string) =>
        key === "JWT_ACCESS_TTL" ? "banana" : configValues[key],
      ),
    } as unknown as ConfigService);

    expect(svc.accessTtlSeconds()).toBe(0);
  });

  it("buildAuthTokens returns the AuthTokens body shape", () => {
    const body = service.buildAuthTokens("abc");
    expect(body).toEqual({
      accessToken: "abc",
      tokenType: "Bearer",
      expiresIn: 900,
    });
  });

  it("sets the refresh cookie httpOnly, sameSite lax, path / and not secure outside production", () => {
    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as CookieResponse;

    service.setRefreshCookie(res, "refresh-token-value");

    expect((res.cookie as jest.Mock)).toHaveBeenCalledTimes(1);
    const [name, value, options] = (res.cookie as jest.Mock).mock.calls[0];
    expect(name).toBe(REFRESH_COOKIE);
    expect(name).toBe("refresh_token");
    expect(value).toBe("refresh-token-value");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(options.maxAge).toBe(604800 * 1000);
  });

  it("marks the cookie secure in production", () => {
    const prodConfig = {
      get: jest.fn((key: string) =>
        key === "NODE_ENV" ? "production" : configValues[key],
      ),
    } as unknown as ConfigService;
    const prod = new TokenService(jwt as unknown as JwtService, prodConfig);
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as CookieResponse;

    prod.setRefreshCookie(res, "x");
    expect((res.cookie as jest.Mock).mock.calls[0][2].secure).toBe(true);
  });

  it("clearRefreshCookie clears the named cookie at path /", () => {
    const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as CookieResponse;
    service.clearRefreshCookie(res);
    expect((res.clearCookie as jest.Mock)).toHaveBeenCalledWith(
      "refresh_token",
      { path: "/" },
    );
  });

  it("reads the refresh cookie from the request", () => {
    expect(
      service.readRefreshCookie({ cookies: { refresh_token: "abc" } }),
    ).toBe("abc");
    expect(service.readRefreshCookie({})).toBeUndefined();
  });
});
