import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../modules/roles/entities/user-role.entity';
import { RolePermission } from '../../modules/roles/entities/role-permission.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasRequiredPermissions =
      requiredPermissions && requiredPermissions.length > 0;
    const hasRequiredRoles = requiredRoles && requiredRoles.length > 0;

    // If neither is required, allow access
    if (!hasRequiredPermissions && !hasRequiredRoles) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !user.id) throw new ForbiddenException('Unauthorized');

    // Load user roles
    const userRoleRepo = this.dataSource.getRepository(UserRole);
    const userRoles = await userRoleRepo.find({
      where: { user: { id: user.id } },
      relations: ['role'],
    });
    if (!userRoles || userRoles.length === 0)
      throw new ForbiddenException('Insufficient permissions');

    // Super admin bypass
    const userRoleNames = userRoles.map((ur) => (ur.role as any).name);
    if (userRoleNames.includes('super_admin')) return true;

    // 1. Check Roles
    if (hasRequiredRoles) {
      const hasRole = requiredRoles.some((role) =>
        userRoleNames.includes(role),
      );
      if (!hasRole)
        throw new ForbiddenException('Insufficient role privileges');
    }

    // 2. Check Permissions
    if (hasRequiredPermissions) {
      const roleIds = userRoles.map((ur) => (ur.role as any).id);

      const rpRepo = this.dataSource.getRepository(RolePermission);
      const rolePerms = await rpRepo
        .createQueryBuilder('rp')
        .innerJoinAndSelect('rp.permission', 'permission')
        .where('rp.role_id IN (:...ids)', { ids: roleIds })
        .getMany();

      const granted = new Set(rolePerms.map((r) => (r.permission as any).code));

      // Check if JWT includes cached permissions (optional optimization)
      if (Array.isArray(user.permissions)) {
        user.permissions.forEach((p) => granted.add(p));
      }

      const hasAll = requiredPermissions.every((p) => granted.has(p));
      if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
