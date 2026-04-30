import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';

@Entity('maintenance_schedules')
@Index('idx_maintsched_due', ['next_due_date'])
@Index('idx_maintsched_active', ['is_active'])
export class MaintenanceSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string; // e.g., "Quarterly Elevator Inspection"

  @Column({ length: 50 })
  category: string; // e.g., "elevator", "hvac", "fire_safety"

  @Column({ length: 20 })
  priority: string; // e.g., "high", "medium", "low"

  @Column({ type: 'int' })
  frequency_days: number; // e.g., 90 for quarterly

  @Column({ type: 'date' })
  next_due_date: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  building_id: string;

  @ManyToOne(() => Building, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
