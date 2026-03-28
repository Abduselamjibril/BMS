import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { MaintenanceRequest } from './maintenance-request.entity';
import { User } from '../../users/entities/user.entity';

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

  @ManyToOne(() => User, { nullable: true })
  user?: User;

  @CreateDateColumn()
  created_at!: Date;
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MaintenanceRequest, { nullable: false })
  request!: MaintenanceRequest;

  @ManyToOne(() => Contractor, { nullable: false })
  contractor!: Contractor;

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

  @Column({ type: 'varchar', length: 255, nullable: true })
  photo_reported?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photo_in_progress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photo_completed?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proofUrl?: string; // Keep for backward compatibility or as alias for completed

  @Column({ type: 'timestamp', nullable: true })
  sla_resolution_deadline?: Date;

  @Column({ default: false })
  is_resolution_breached!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
