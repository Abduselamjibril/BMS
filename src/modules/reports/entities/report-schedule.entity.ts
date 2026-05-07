import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  report_type: string; // e.g., 'financial', 'occupancy', 'maintenance'

  @Column({
    type: 'enum',
    enum: ReportFrequency,
    default: ReportFrequency.WEEKLY,
  })
  frequency: ReportFrequency;

  @Column()
  recipient_email: string;

  @Column({ type: 'jsonb', nullable: true })
  filters: any;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_sent_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
