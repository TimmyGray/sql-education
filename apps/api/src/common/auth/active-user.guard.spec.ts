import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { ActiveUserGuard } from "./active-user.guard";
import { AuthUser } from "./auth-user";

describe("ActiveUserGuard", () => {
  const guard = new ActiveUserGuard();

  const makeCtx = (user?: Partial<AuthUser>): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

  it("throws Unauthorized when no user is attached (guard ran without JwtAuthGuard)", () => {
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it("throws Forbidden for a PENDING account", () => {
    expect(() => guard.canActivate(makeCtx({ status: "PENDING" }))).toThrow(
      ForbiddenException,
    );
  });

  it("returns true for an ACTIVE account", () => {
    expect(guard.canActivate(makeCtx({ status: "ACTIVE" }))).toBe(true);
  });
});
