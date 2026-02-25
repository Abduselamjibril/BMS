import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Unit } from '../../units/entities/unit.entity';

export enum MaintenanceStatus {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

@Entity('maintenance_requests')
export class MaintenanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant!: Tenant;

  @ManyToOne(() => Unit, { nullable: false })
  unit!: Unit;

  @Column({ length: 50 })
  category!: string; // e.g. plumbing, electric

  @Column({ length: 20 })
  priority!: string; // e.g. high, medium, low

  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.SUBMITTED })
  status!: MaintenanceStatus;

  @Column({ type: 'text' })
  description!: string;

  @CreateDateColumn()
  created_at!: Date;
}
