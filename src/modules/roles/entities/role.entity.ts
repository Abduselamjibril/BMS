import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from './user-role.entity';
import { RolePermission } from './role-permission.entity';

export enum RoleName {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  NOMINEE_ADMIN = 'nominee_admin',
  ADMIN = 'admin',
  SITE_ADMIN = 'site_admin',
  CONTRACTOR = 'contractor',
}

export enum RoleType {
  SYSTEM = 'system',
  COMPANY = 'company',
  BUILDING = 'building',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: RoleName })
  name!: RoleName;

  @Column({ type: 'enum', enum: RoleType })
  type!: RoleType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles!: UserRole[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
