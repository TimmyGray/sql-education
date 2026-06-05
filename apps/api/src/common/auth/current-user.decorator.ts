import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUser, RequestWithUser } from "./auth-user";

/**
 * Injects the authenticated {@link AuthUser} (set by `JwtAuthGuard`) into a
 * controller handler. Pass a key to grab a single field:
 *
 *   handler(@CurrentUser() user: AuthUser) {}
 *   handler(@CurrentUser('userId') userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
