import { Building } from '../../buildings/entities/building.entity';
import { Unit } from '../../units/entities/unit.entity';
import { User } from '../../users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum TenantApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('tenant_applications')
@Index('idx_tenantapp_status', ['status'])
@Index('id_tenant_app', ['tenant'])
@Index('id_building_app', ['building'])
@Index('id_unit_app', ['unit'])
export class TenantApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.applications, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @ManyToOne(() => Building, { nullable: false })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @Column({
    type: 'enum',
    enum: TenantApplicationStatus,
    default: TenantApplicationStatus.SUBMITTED,
  })
  status!: TenantApplicationStatus;

  @Column({ type: 'date' })
  move_in_date!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewed_by?: User;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;
}
