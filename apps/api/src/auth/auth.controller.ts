import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthTokens, TestAccountTokens, User } from "@sql-edu/contracts";
import { CurrentUser, JwtAuthGuard } from "../common";
import { AuthService } from "./auth.service";
import { getClientIp, ClientIpRequest } from "./client-ip";
import {
  CookieRequest,
  CookieResponse,
  TokenService,
} from "./token.service";
import {
  ActivateDto,
  LoginDto,
  RegisterDto,
  ResendCodeDto,
} from "./dto";

/**
 * Auth endpoints. Cookie-bearing routes use `@Res({ passthrough: true })` so the
 * handler can set/clear the httpOnly refresh cookie while Nest still serialises
 * the returned body.
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  /** Register a new (PENDING) account. */
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    return this.auth.register(dto);
  }

  /** Activate an account with the emailed code; returns tokens + sets cookie. */
  @Post("activate")
  @HttpCode(HttpStatus.OK)
  activate(
    @Body() dto: ActivateDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthTokens> {
    return this.auth.activate(dto, res);
  }

  /** Log in; returns tokens + sets refresh cookie. */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthTokens> {
    return this.auth.login(dto, res);
  }

  /**
   * Create a temporary, pre-activated test account (no email sent) and log in
   * as it. Limited to one per IP per hour; the account auto-expires after 30
   * minutes.
   */
  @Post("test-account")
  @HttpCode(HttpStatus.CREATED)
  createTestAccount(
    @Req() req: CookieRequest & ClientIpRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<TestAccountTokens> {
    return this.auth.createTestAccount(getClientIp(req), res);
  }

  /** Re-send an activation code (rate-limited by a cooldown). */
  @Post("resend-code")
  @HttpCode(HttpStatus.OK)
  resendCode(@Body() dto: ResendCodeDto): Promise<{ message: string }> {
    return this.auth.resendCode(dto);
  }

  /** Rotate the refresh token (reads the cookie); returns a fresh access token. */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<AuthTokens> {
    return this.auth.refresh(this.tokens.readRefreshCookie(req), res);
  }

  /** Log out: revoke the refresh jti and clear the cookie. */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: CookieResponse,
  ): Promise<{ message: string }> {
    return this.auth.logout(this.tokens.readRefreshCookie(req), res);
  }

  /** Current user (works for PENDING accounts so the UI can read status). */
  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser("userId") userId: string): Promise<User> {
    return this.auth.getMe(userId);
  }
}
