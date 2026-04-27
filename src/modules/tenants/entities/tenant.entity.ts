import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TenantApplication } from './tenant-application.entity';
import { TenantDocument } from './tenant-document.entity';
import { ManagementCompany } from '../../management/entities/management-company.entity';

export enum TenantStatus {
  ACTIVE = 'active',
  BLACKLISTED = 'blacklisted',
}

export enum TenantType {
  PERSONAL = 'personal',
  ORGANIZATIONAL = 'organizational',
}

@Entity('tenants')
@Index('idx_tenant_phone', ['phone'])
@Index('idx_tenant_email', ['email'])
@Index('idx_tenant_status', ['status'])
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 100 })
  first_name!: string;

  @Column({ length: 100 })
  last_name!: string;

  @Column({ unique: true, length: 20 })
  phone!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true, length: 50 })
  tin_number?: string;

  @Column({ nullable: true, length: 50 })
  vat_reg_number?: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  @Column({ type: 'enum', enum: TenantType, default: TenantType.PERSONAL })
  tenant_type!: TenantType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  id_image?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  detailed_address?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  license_image?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_image?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  tin_certificate_image?: string;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => TenantApplication, (application) => application.tenant)
  applications!: TenantApplication[];

  @OneToMany(() => TenantDocument, (document) => document.tenant)
  documents!: TenantDocument[];

  @ManyToOne(() => ManagementCompany, { nullable: true })
  @JoinColumn({ name: 'managed_by_company_id' })
  managed_by_company?: ManagementCompany;

  @Column({ nullable: true })
  managed_by_company_id?: string;
}
