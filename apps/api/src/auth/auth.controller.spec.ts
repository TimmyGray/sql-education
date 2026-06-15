import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import {
  CookieRequest,
  CookieResponse,
  TokenService,
} from "./token.service";
import { ClientIpRequest } from "./client-ip";

describe("AuthController", () => {
  let auth: jest.Mocked<
    Pick<
      AuthService,
      | "register"
      | "activate"
      | "login"
      | "createTestAccount"
      | "resendCode"
      | "refresh"
      | "logout"
      | "getMe"
    >
  >;
  let tokens: jest.Mocked<Pick<TokenService, "readRefreshCookie">>;
  let controller: AuthController;
  const res = {} as CookieResponse;

  beforeEach(() => {
    auth = {
      register: jest.fn().mockResolvedValue({ message: "registered" }),
      activate: jest.fn().mockResolvedValue({ accessToken: "a" }),
      login: jest.fn().mockResolvedValue({ accessToken: "l" }),
      createTestAccount: jest.fn().mockResolvedValue({ accessToken: "t" }),
      resendCode: jest.fn().mockResolvedValue({ message: "resent" }),
      refresh: jest.fn().mockResolvedValue({ accessToken: "r" }),
      logout: jest.fn().mockResolvedValue({ message: "bye" }),
      getMe: jest.fn().mockResolvedValue({ id: "u1" }),
    } as unknown as typeof auth;
    tokens = {
      readRefreshCookie: jest.fn().mockReturnValue("refresh-tok"),
    } as unknown as typeof tokens;
    controller = new AuthController(
      auth as unknown as AuthService,
      tokens as unknown as TokenService,
    );
  });

  it("register delegates to AuthService.register", async () => {
    const dto = { email: "a@test.com" } as never;
    await expect(controller.register(dto)).resolves.toEqual({
      message: "registered",
    });
    expect(auth.register).toHaveBeenCalledWith(dto);
  });

  it("activate passes the dto and response through", async () => {
    const dto = {} as never;
    await controller.activate(dto, res);
    expect(auth.activate).toHaveBeenCalledWith(dto, res);
  });

  it("login passes the dto and response through", async () => {
    const dto = {} as never;
    await controller.login(dto, res);
    expect(auth.login).toHaveBeenCalledWith(dto, res);
  });

  it("createTestAccount resolves the client IP from the request and delegates", async () => {
    const req = { ip: "1.2.3.4" } as CookieRequest & ClientIpRequest;
    await controller.createTestAccount(req, res);
    expect(auth.createTestAccount).toHaveBeenCalledWith("1.2.3.4", res);
  });

  it("resendCode delegates to AuthService.resendCode", async () => {
    const dto = {} as never;
    await controller.resendCode(dto);
    expect(auth.resendCode).toHaveBeenCalledWith(dto);
  });

  it("refresh reads the refresh cookie then delegates", async () => {
    const req = {} as CookieRequest;
    await controller.refresh(req, res);
    expect(tokens.readRefreshCookie).toHaveBeenCalledWith(req);
    expect(auth.refresh).toHaveBeenCalledWith("refresh-tok", res);
  });

  it("logout reads the refresh cookie then delegates", async () => {
    const req = {} as CookieRequest;
    await controller.logout(req, res);
    expect(tokens.readRefreshCookie).toHaveBeenCalledWith(req);
    expect(auth.logout).toHaveBeenCalledWith("refresh-tok", res);
  });

  it("me delegates with the current userId", async () => {
    await expect(controller.me("u1")).resolves.toEqual({ id: "u1" });
    expect(auth.getMe).toHaveBeenCalledWith("u1");
  });
});
