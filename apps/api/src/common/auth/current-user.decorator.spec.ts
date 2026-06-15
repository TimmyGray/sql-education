import "reflect-metadata";
import { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { CurrentUser } from "./current-user.decorator";
import { AuthUser } from "./auth-user";

type Factory = (
  data: keyof AuthUser | undefined,
  ctx: ExecutionContext,
) => unknown;

/**
 * `createParamDecorator` stores the underlying factory in route-args metadata.
 * Apply the decorator to a throwaway method, then read the factory back out so
 * we can invoke it directly with a fake ExecutionContext.
 */
function getParamFactory(
  decorator: (...args: unknown[]) => ParameterDecorator,
): Factory {
  class Probe {
    handler(@decorator() _value: unknown): void {
      void _value;
    }
  }
  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, "handler");
  const key = Object.keys(meta)[0];
  return meta[key].factory as Factory;
}

describe("CurrentUser decorator", () => {
  const user: AuthUser = {
    userId: "u1",
    email: "a@test.com",
    status: "ACTIVE",
  };
  const factory = getParamFactory(CurrentUser as never);

  const ctx = (u?: AuthUser): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user: u }) }) }) as unknown as ExecutionContext;

  it("returns the whole user when no key is given", () => {
    expect(factory(undefined, ctx(user))).toEqual(user);
  });

  it("returns a single field when a key is given", () => {
    expect(factory("userId", ctx(user))).toBe("u1");
    expect(factory("email", ctx(user))).toBe("a@test.com");
  });

  it("returns undefined for a key when no user is attached", () => {
    expect(factory("userId", ctx(undefined))).toBeUndefined();
  });

  it("returns undefined when neither user nor key is present", () => {
    expect(factory(undefined, ctx(undefined))).toBeUndefined();
  });
});
