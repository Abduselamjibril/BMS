import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleName, RoleType } from './entities/role.entity';
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
    const exists = await this.roleRepository.findOne({ where: { name: createRoleDto.name } });
    if (exists) throw new ConflictException('Role already exists');
    const role = this.roleRepository.create(createRoleDto);
    return this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({ relations: ['rolePermissions'] });
  }

  async update(id: string, dto: Partial<CreateRoleDto>): Promise<Role> {
    await this.roleRepository.update(id, dto);
    const updated = await this.roleRepository.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Role not found');
    return updated;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    // Check if any users are assigned to this role
    const role = await this.roleRepository.findOne({ where: { id }, relations: ['userRoles'] });
    if (!role) throw new NotFoundException('Role not found');
    if (role.userRoles && role.userRoles.length > 0) {
      throw new ConflictException('Cannot delete role: users are assigned');
    }
    await this.roleRepository.delete(id);
    return { deleted: true };
  }

  async assignPermissions(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    await this.rolePermissionRepository.delete({ role: { id: roleId } });
    const permissions = await this.permissionRepository.findByIds(dto.permissionIds);
    const rolePermissions = permissions.map((permission) =>
      this.rolePermissionRepository.create({ role, permission })
    );
    return this.rolePermissionRepository.save(rolePermissions);
  }
}
