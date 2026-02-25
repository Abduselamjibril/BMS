import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
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
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are required on the handler, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    // Require an authenticated user (JwtAuthGuard should run first when used via @Auth())
    if (!user || !user.id) throw new ForbiddenException('Unauthorized');

    // If JWT included permissions/roles, prefer them to avoid extra DB queries
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      const granted = new Set(user.permissions as string[]);
      const hasAll = requiredPermissions.every((p) => granted.has(p));
      if (!hasAll) throw new ForbiddenException('Insufficient permissions');
      return true;
    }

    // Fallback: load user roles and role->permission mapping from DB
    const userRoleRepo = this.dataSource.getRepository(UserRole);
    const userRoles = await userRoleRepo.find({ where: { user: { id: user.id } }, relations: ['role'] });
    if (!userRoles || userRoles.length === 0) throw new ForbiddenException('Insufficient permissions');

    // Super admin bypass if role name matches
    if (userRoles.some((ur) => (ur.role as any).name === 'super_admin')) return true;

    const roleIds = userRoles.map((ur) => (ur.role as any).id);

    // Load permissions assigned to these roles
    const rpRepo = this.dataSource.getRepository(RolePermission);
    const rolePerms = await rpRepo
      .createQueryBuilder('rp')
      .innerJoinAndSelect('rp.permission', 'permission')
      .where('rp.role_id IN (:...ids)', { ids: roleIds })
      .getMany();

    const granted = new Set(rolePerms.map((r) => (r.permission as any).code));

    const hasAll = requiredPermissions.every((p) => granted.has(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
