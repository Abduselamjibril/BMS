import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum UtilityType {
  WATER = 'water',
  ELECTRICITY = 'electricity',
}

@Entity('utility_meters')
export class UtilityMeter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  unit_id!: string;

  @Column({ type: 'enum', enum: UtilityType })
  type!: UtilityType;

  @Column({ length: 200, nullable: true })
  serial_no?: string;

  @Column({ type: 'double precision', nullable: true })
  initial_reading?: number;

  @CreateDateColumn()
  created_at!: Date;
}
