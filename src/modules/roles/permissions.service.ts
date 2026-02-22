import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}


  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const exists = await this.permissionRepository.findOne({ where: { code: createPermissionDto.code } });
    if (exists) throw new ConflictException('Permission code already exists');
    const permission = this.permissionRepository.create(createPermissionDto);
    return this.permissionRepository.save(permission);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const permission = await this.permissionRepository.findOne({ where: { id } });
    if (!permission) throw new Error('Permission not found');
    await this.permissionRepository.delete(id);
    return { deleted: true };
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }
}
