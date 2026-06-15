import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("applies sensible defaults when keys are absent", () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.JWT_ACCESS_SECRET).toBe("dev_access_secret_change_me");
    expect(env.JWT_REFRESH_TTL).toBe("7d");
  });

  it("coerces numeric strings (PORT, SMTP_PORT) to numbers", () => {
    const env = validateEnv({ PORT: "4000", SMTP_PORT: "2525" });
    expect(env.PORT).toBe(4000);
    expect(env.SMTP_PORT).toBe(2525);
  });

  it("passes unknown keys through untouched", () => {
    const env = validateEnv({ SOME_EXTRA: "keep-me" }) as Record<string, unknown>;
    expect(env.SOME_EXTRA).toBe("keep-me");
  });

  it("leaves optional integrations undefined when not provided", () => {
    const env = validateEnv({});
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it("throws when NODE_ENV is not a known value", () => {
    expect(() => validateEnv({ NODE_ENV: "staging" })).toThrow();
  });

  it("throws when PORT is not a positive integer", () => {
    expect(() => validateEnv({ PORT: "not-a-number" })).toThrow();
  });
});
