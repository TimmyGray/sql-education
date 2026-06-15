jest.mock("../api-client", () => ({ request: jest.fn() }));

import { request } from "../api-client";
import * as authApi from "./auth";

const requestMock = request as unknown as jest.Mock;

const AUTH_TOKENS = { accessToken: "a", tokenType: "Bearer", expiresIn: 900 };
const TEST_TOKENS = {
  ...AUTH_TOKENS,
  testAccountExpiresAt: "2025-01-01T00:30:00.000Z",
};
const USER = {
  id: "u1",
  email: "a@test.com",
  displayName: "Ada",
  status: "ACTIVE",
  createdAt: "2025-01-01T00:00:00.000Z",
  isTestAccount: false,
  testAccountExpiresAt: null,
};

beforeEach(() => requestMock.mockReset());

describe("auth API wrappers", () => {
  it("register POSTs the body to /auth/register", async () => {
    requestMock.mockResolvedValue({ message: "ok" });
    const body = { email: "a@test.com", password: "p", confirmPassword: "p" };

    await expect(authApi.register(body)).resolves.toEqual({ message: "ok" });
    expect(requestMock).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      json: body,
    });
  });

  it("activate POSTs and validates the AuthTokens response", async () => {
    requestMock.mockResolvedValue(AUTH_TOKENS);
    await expect(
      authApi.activate({ email: "a@test.com", code: "123456" }),
    ).resolves.toEqual(AUTH_TOKENS);
    expect(requestMock).toHaveBeenCalledWith("/auth/activate", {
      method: "POST",
      json: { email: "a@test.com", code: "123456" },
    });
  });

  it("login POSTs and validates the AuthTokens response", async () => {
    requestMock.mockResolvedValue(AUTH_TOKENS);
    await expect(
      authApi.login({ email: "a@test.com", password: "p" }),
    ).resolves.toEqual(AUTH_TOKENS);
    expect(requestMock).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      json: { email: "a@test.com", password: "p" },
    });
  });

  it("createTestAccount POSTs and validates TestAccountTokens", async () => {
    requestMock.mockResolvedValue(TEST_TOKENS);
    await expect(authApi.createTestAccount()).resolves.toEqual(TEST_TOKENS);
    expect(requestMock).toHaveBeenCalledWith("/auth/test-account", {
      method: "POST",
    });
  });

  it("resendCode POSTs the email", async () => {
    requestMock.mockResolvedValue({ message: "sent" });
    await authApi.resendCode({ email: "a@test.com" });
    expect(requestMock).toHaveBeenCalledWith("/auth/resend-code", {
      method: "POST",
      json: { email: "a@test.com" },
    });
  });

  it("refresh POSTs with accessToken:null and validates AuthTokens", async () => {
    requestMock.mockResolvedValue(AUTH_TOKENS);
    await expect(authApi.refresh()).resolves.toEqual(AUTH_TOKENS);
    expect(requestMock).toHaveBeenCalledWith("/auth/refresh", {
      method: "POST",
      accessToken: null,
    });
  });

  it("logout POSTs to /auth/logout", async () => {
    requestMock.mockResolvedValue({ message: "bye" });
    await authApi.logout();
    expect(requestMock).toHaveBeenCalledWith("/auth/logout", { method: "POST" });
  });

  it("getMe GETs /auth/me and validates the User", async () => {
    requestMock.mockResolvedValue(USER);
    await expect(authApi.getMe()).resolves.toEqual(USER);
    expect(requestMock).toHaveBeenCalledWith("/auth/me");
  });

  it("updateProfile PATCHes /users/me and validates the User", async () => {
    requestMock.mockResolvedValue({ ...USER, displayName: "New" });
    await expect(
      authApi.updateProfile({ displayName: "New" }),
    ).resolves.toMatchObject({ displayName: "New" });
    expect(requestMock).toHaveBeenCalledWith("/users/me", {
      method: "PATCH",
      json: { displayName: "New" },
    });
  });

  it("propagates a schema validation error when the response is malformed", async () => {
    requestMock.mockResolvedValue({ accessToken: 123 });
    await expect(
      authApi.login({ email: "a@test.com", password: "p" }),
    ).rejects.toThrow();
  });
});
