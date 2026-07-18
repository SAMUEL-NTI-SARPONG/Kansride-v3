import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from '@kansride/auth';
import type { Permission } from '@kansride/auth';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly rbacService = new RBACService();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<Permission[]>('permissions', context.getHandler());
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('No user context');

    const hasPermission = this.rbacService.hasAnyPermission(user.role, requiredPermissions);
    if (!hasPermission) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
