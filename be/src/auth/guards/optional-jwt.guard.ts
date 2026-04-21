import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT guard: if a valid Bearer token is present, req.user is populated.
 * If no token (or invalid token), request still passes with req.user = undefined.
 * Use for endpoints that serve different content to authenticated vs anonymous users.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  // Never throw — unauthenticated requests are allowed
  handleRequest(_err: any, user: any) {
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
