import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();

    if (!user) return false;

    // Support both user.roles (array) and user.role (object with name)
    const userRoles: string[] = user.roles || (user.role?.name ? [user.role.name] : []);

    return required.some((r) =>
      userRoles.some(role => role.toUpperCase() === r.toUpperCase())
    );
  }
}
