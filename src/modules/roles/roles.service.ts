import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleType } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { Permission } from './entities/permission.entity';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RolePermission } from './entities/role-permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    if (createRoleDto.name === 'super_admin') {
      throw new ConflictException('The super_admin role is system-protected and cannot be created manually.');
    }
    const exists = await this.roleRepository.findOne({ where: { name: createRoleDto.name } });
    if (exists) throw new ConflictException('Role already exists');
    const role = this.roleRepository.create(createRoleDto);
    return this.roleRepository.save(role);
  }

  async findAll(): Promise<any[]> {
    const roles = await this.roleRepository.find({ relations: ['rolePermissions', 'rolePermissions.permission'] });
    return roles.map((r) => {
      const permsMap = new Map<string, any>();
      for (const rp of r.rolePermissions || []) {
        const p = (rp as RolePermission).permission as Permission;
        if (!p) continue;
        // attach rolePermission id alongside permission and avoid duplicates
        if (!permsMap.has(p.id)) {
          permsMap.set(p.id, { id: p.id, code: p.code, description: p.description, rolePermissionId: (rp as RolePermission).id });
        }
      }
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        description: r.description,
        permissions: Array.from(permsMap.values()),
      };
    });
  }

  async update(id: string, dto: Partial<CreateRoleDto>): Promise<Role> {
    const roleToUpdate = await this.roleRepository.findOne({ where: { id } });
    if (!roleToUpdate) throw new NotFoundException('Role not found');
    if (roleToUpdate.name === 'super_admin') {
      throw new ConflictException('The super_admin role cannot be modified.');
    }
    await this.roleRepository.update(id, dto);
    const updated = await this.roleRepository.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Role not found');
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    // Check if any users are assigned to this role
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['userRoles'] });
    if (!role) return { message: 'Role not found or already deleted.' };
    if (role.name === 'super_admin') {
      throw new ConflictException('The super_admin role cannot be deleted.');
    }
    if (role.userRoles && role.userRoles.length > 0) {
      throw new ConflictException('Cannot delete role: users are assigned');
    }
    await this.roleRepository.delete(id);
    return { message: 'Role deleted successfully.' };
  }

  async assignPermissions(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'super_admin') {
      throw new ConflictException('The super_admin role has implicit access to all permissions and cannot be modified.');
    }
    await this.rolePermissionRepository.delete({ role: { id: roleId } });
    const permissions = await this.permissionRepository.findByIds(dto.permissionIds);
    const rolePermissions = permissions.map((permission) =>
      this.rolePermissionRepository.create({ role, permission })
    );
    return this.rolePermissionRepository.save(rolePermissions);
  }
}
