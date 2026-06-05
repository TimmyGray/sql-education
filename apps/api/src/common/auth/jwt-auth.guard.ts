import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  AccessTokenPayload,
  AuthUser,
  RequestWithUser,
} from "./auth-user";

/**
 * Verifies the `Authorization: Bearer <accessToken>` header using
 * `JWT_ACCESS_SECRET` and populates `req.user` with an {@link AuthUser}.
 *
 * Provided globally by {@link CommonModule}; feature controllers just apply it
 * with `@UseGuards(JwtAuthGuard)`. Does NOT require the account to be ACTIVE —
 * combine with {@link ActiveUserGuard} for routes that need an activated user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwt = new JwtService();

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers["authorization"];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !raw.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = raw.slice("Bearer ".length).trim();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    const user: AuthUser = {
      userId: payload.sub,
      email: payload.email,
      status: payload.status,
    };
    req.user = user;
    return true;
  }
}
