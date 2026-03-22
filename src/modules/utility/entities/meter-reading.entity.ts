import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UtilityMeter } from './utility-meter.entity';

@Entity('meter_readings')
export class MeterReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  meter_id!: string;

  @ManyToOne(() => UtilityMeter)
  @JoinColumn({ name: 'meter_id' })
  meter?: UtilityMeter;

  @Column({ type: 'double precision' })
  reading_value!: number;

  @Column({ type: 'date' })
  reading_date!: Date;

  @Column({ length: 500, nullable: true })
  photo_url?: string;

  @Column({ default: false })
  is_billed!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
