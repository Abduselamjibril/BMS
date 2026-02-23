import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TenantApplication } from './tenant-application.entity';
import { TenantDocument } from './tenant-document.entity';

export enum TenantStatus {
  ACTIVE = 'active',
  BLACKLISTED = 'blacklisted',
}

@Entity('tenants')
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

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => TenantApplication, (application) => application.tenant)
  applications!: TenantApplication[];

  @OneToMany(() => TenantDocument, (document) => document.tenant)
  documents!: TenantDocument[];
}
