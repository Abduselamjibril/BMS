import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Unit } from '../../units/entities/unit.entity';
import { Building } from '../../buildings/entities/building.entity';

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum LeaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  RENEWED = 'RENEWED',
}

@Entity('leases')
export class Lease {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  lease_number!: string;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @ManyToOne(() => Building, { nullable: false })
  @JoinColumn({ name: 'building_id' })
  building!: Building;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  end_date!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  rent_amount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  service_charge!: number;

  @Column({ type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billing_cycle!: BillingCycle;

  @Column({ type: 'enum', enum: LeaseStatus, default: LeaseStatus.DRAFT })
  status!: LeaseStatus;

  @Column({ nullable: true, length: 500 })
  doc_path?: string;

  @ManyToOne(() => Lease, { nullable: true })
  @JoinColumn({ name: 'previous_lease_id' })
  previous_lease?: Lease;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
