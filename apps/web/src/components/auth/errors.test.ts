import { ApiError } from "@/lib/api-client";
import { toFriendlyMessage, isApiStatus } from "./errors";

describe("toFriendlyMessage", () => {
  it("maps 401 to an incorrect-credentials message", () => {
    expect(toFriendlyMessage(new ApiError(401, "Unauthorized"))).toBe(
      "Incorrect email or password.",
    );
  });

  it("maps 409 to an already-registered message", () => {
    expect(toFriendlyMessage(new ApiError(409, "Conflict"))).toMatch(
      /already registered/,
    );
  });

  it("maps 429 to a slow-down message", () => {
    expect(toFriendlyMessage(new ApiError(429, "Too many requests"))).toMatch(
      /wait a moment/,
    );
  });

  it("uses the ApiError message for other statuses", () => {
    expect(toFriendlyMessage(new ApiError(400, "Bad code"))).toBe("Bad code");
  });

  it("falls back when an ApiError has an empty message", () => {
    expect(toFriendlyMessage(new ApiError(400, ""), "fallback!")).toBe(
      "fallback!",
    );
  });

  it("maps a TypeError (network failure) to a connection message", () => {
    expect(toFriendlyMessage(new TypeError("Failed to fetch"))).toMatch(
      /Can't reach the server/,
    );
  });

  it("uses a generic Error's message", () => {
    expect(toFriendlyMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back for an Error with no message", () => {
    expect(toFriendlyMessage(new Error(""), "default")).toBe("default");
  });

  it("falls back for a non-error value", () => {
    expect(toFriendlyMessage("nope")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("isApiStatus", () => {
  it("is true for a matching ApiError status", () => {
    expect(isApiStatus(new ApiError(403, "x"), 403)).toBe(true);
  });

  it("is false for a different status", () => {
    expect(isApiStatus(new ApiError(401, "x"), 403)).toBe(false);
  });

  it("is false for a non-ApiError", () => {
    expect(isApiStatus(new Error("x"), 403)).toBe(false);
  });
});
