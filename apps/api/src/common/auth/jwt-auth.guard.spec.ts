import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RequestWithUser } from "./auth-user";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let verifySpy: jest.SpyInstance;

  const config = {
    get: jest.fn(() => "access-secret"),
  } as unknown as ConfigService;

  const makeCtx = (req: RequestWithUser): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new JwtAuthGuard(config);
    verifySpy = jest.spyOn(JwtService.prototype, "verifyAsync");
  });

  afterEach(() => jest.restoreAllMocks());

  it("throws when the Authorization header is missing", async () => {
    await expect(guard.canActivate(makeCtx({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws when the header does not start with 'Bearer '", async () => {
    await expect(
      guard.canActivate(makeCtx({ headers: { authorization: "Basic abc" } })),
    ).rejects.toThrow("Missing bearer token");
  });

  it("populates req.user and returns true for a valid token", async () => {
    verifySpy.mockResolvedValue({
      sub: "u1",
      email: "a@test.com",
      status: "ACTIVE",
    });
    const req: RequestWithUser = {
      headers: { authorization: "Bearer good.token" },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.user).toEqual({
      userId: "u1",
      email: "a@test.com",
      status: "ACTIVE",
    });
    expect(verifySpy).toHaveBeenCalledWith("good.token", {
      secret: "access-secret",
    });
  });

  it("accepts an array-valued Authorization header (uses the first)", async () => {
    verifySpy.mockResolvedValue({
      sub: "u2",
      email: "b@test.com",
      status: "PENDING",
    });
    const req: RequestWithUser = {
      headers: { authorization: ["Bearer good", "Bearer other"] },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.user?.userId).toBe("u2");
  });

  it("throws when token verification fails", async () => {
    verifySpy.mockRejectedValue(new Error("bad signature"));
    await expect(
      guard.canActivate(
        makeCtx({ headers: { authorization: "Bearer bad.token" } }),
      ),
    ).rejects.toThrow("Invalid or expired access token");
  });
});
