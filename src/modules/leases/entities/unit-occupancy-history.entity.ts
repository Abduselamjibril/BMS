import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum OccupancyStatus {
  CURRENT = 'current',
  PREVIOUS = 'previous',
}

@Entity('unit_occupancy_history')
export class UnitOccupancyHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Unit, { nullable: false })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date', nullable: true })
  end_date?: string;

  @Column({
    type: 'enum',
    enum: OccupancyStatus,
    default: OccupancyStatus.CURRENT,
  })
  status!: OccupancyStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
