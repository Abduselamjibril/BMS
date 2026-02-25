import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { MaintenanceRequest } from './maintenance-request.entity';

@Entity('contractors')
export class Contractor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20 })
  phone!: string;

  @Column({ length: 50 })
  specialization!: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @Column({ length: 20, default: 'active' })
  status!: string;
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MaintenanceRequest, { nullable: false })
  request!: MaintenanceRequest;

  @Column({ nullable: false })
  contractor_id!: string;

  @Column({ nullable: false })
  assigned_by!: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_date?: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  cost_estimate?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  actual_cost?: number;

  @Column({ length: 20, default: 'assigned' })
  status!: string;
}
