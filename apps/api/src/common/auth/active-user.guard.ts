import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RequestWithUser } from "./auth-user";

/**
 * Requires an ACTIVE (email-confirmed) account. MUST run after
 * {@link JwtAuthGuard}, e.g. `@UseGuards(JwtAuthGuard, ActiveUserGuard)`.
 *
 * PENDING users are rejected with 403 so the frontend can route them to the
 * activation page. (Activation / resend / logout endpoints should NOT use this
 * guard.)
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (!req.user) {
      throw new UnauthorizedException("Not authenticated");
    }
    if (req.user.status !== "ACTIVE") {
      throw new ForbiddenException("Account not activated");
    }
    return true;
  }
}
