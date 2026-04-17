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
import { ManagementCompany } from '../../management/entities/management-company.entity';

export enum DepositStatus {
  HELD = 'HELD',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  BIANNUALLY = 'BIANNUALLY',
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

  @Column({ nullable: true })
  building_id!: string;

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

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  deposit_amount!: number;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.HELD })
  deposit_status!: DepositStatus;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  deposit_refund_amount?: number;

  @Column({ type: 'date', nullable: true })
  deposit_refund_date?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  escalation_pct?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  penalty_amount?: number;

  @Column({ type: 'date', nullable: true })
  next_billing_date?: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  advance_balance!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => ManagementCompany, { nullable: true })
  @JoinColumn({ name: 'managed_by_company_id' })
  managed_by_company?: ManagementCompany;

  @Column({ nullable: true })
  managed_by_company_id?: string;
}
