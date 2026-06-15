import { getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("prefers req.ip when present", () => {
    expect(
      getClientIp({ ip: "9.9.9.9", headers: { "x-forwarded-for": "1.1.1.1" } }),
    ).toBe("9.9.9.9");
  });

  it("falls back to the first x-forwarded-for entry (string, trimmed)", () => {
    expect(
      getClientIp({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } }),
    ).toBe("1.1.1.1");
  });

  it("falls back to the first x-forwarded-for entry (array)", () => {
    expect(
      getClientIp({ headers: { "x-forwarded-for": ["3.3.3.3", "4.4.4.4"] } }),
    ).toBe("3.3.3.3");
  });

  it("ignores an empty x-forwarded-for string and uses the socket address", () => {
    expect(
      getClientIp({
        headers: { "x-forwarded-for": "" },
        socket: { remoteAddress: "5.5.5.5" },
      }),
    ).toBe("5.5.5.5");
  });

  it("ignores an empty x-forwarded-for array and uses the socket address", () => {
    expect(
      getClientIp({
        headers: { "x-forwarded-for": [] },
        socket: { remoteAddress: "6.6.6.6" },
      }),
    ).toBe("6.6.6.6");
  });

  it("returns 'unknown' when nothing identifies the client", () => {
    expect(getClientIp({})).toBe("unknown");
  });
});
