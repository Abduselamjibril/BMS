import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { MaintenanceRequest } from './maintenance-request.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('maintenance_feedback')
@Index('idx_maintfb_rating', ['rating'])
export class MaintenanceFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MaintenanceRequest, { nullable: false })
  request!: MaintenanceRequest;

  @ManyToOne(() => Tenant, { nullable: false })
  tenant!: Tenant;

  @Column({ type: 'int', width: 1 })
  rating!: number; // 1-5

  @Column({ type: 'text', nullable: true })
  comment?: string;
}
