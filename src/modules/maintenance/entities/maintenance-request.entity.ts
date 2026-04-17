import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Unit } from '../../units/entities/unit.entity';
import { WorkOrder } from './contractor-and-workorder.entity';
import { MaintenanceFeedback } from './maintenance-feedback.entity';
import { ManagementCompany } from '../../management/entities/management-company.entity';

export enum MaintenanceStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

@Entity('maintenance_requests')
export class MaintenanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant!: Tenant;

  @ManyToOne(() => Unit, { nullable: true })
  unit?: Unit;

  @Column({ length: 50 })
  category!: string; // e.g. plumbing, electric

  @Column({ length: 20 })
  priority!: string; // e.g. high, medium, low

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SUBMITTED,
  })
  status!: MaintenanceStatus;

  @Column({ type: 'text' })
  description!: string;

  @OneToMany(() => WorkOrder, (workOrder) => workOrder.request)
  workOrders!: WorkOrder[];

  @OneToMany(() => MaintenanceFeedback, (feedback) => feedback.request)
  feedbacks!: MaintenanceFeedback[];

  @Column({ type: 'timestamp', nullable: true })
  sla_deadline?: Date;

  @Column({ default: false })
  is_sla_breached!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => ManagementCompany, { nullable: true })
  @JoinColumn({ name: 'managed_by_company_id' })
  managed_by_company?: ManagementCompany;

  @Column({ nullable: true })
  managed_by_company_id?: string;
}
