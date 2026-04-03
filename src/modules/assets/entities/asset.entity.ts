import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { Unit } from '../../units/entities/unit.entity';

export enum AssetCategory {
  APPLIANCE = 'Appliance',
  FURNITURE = 'Furniture',
  EQUIPMENT = 'Equipment',
  DECOR = 'Decor',
  OTHER = 'Other',
}

export enum AssetCondition {
  NEW = 'New',
  GOOD = 'Good',
  FAIR = 'Fair',
  DAMAGED = 'Damaged',
  POOR = 'Poor',
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: AssetCategory, default: AssetCategory.OTHER })
  category!: AssetCategory;

  @Column({ type: 'enum', enum: AssetCondition, default: AssetCondition.GOOD })
  condition!: AssetCondition;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  value?: number;

  @Column({ type: 'date', nullable: true })
  purchase_date?: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', nullable: true })
  buildingId?: string;
  @ManyToOne(() => Building, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'buildingId' })
  building?: Building;

  @Column({ type: 'uuid', nullable: true })
  unitId?: string;
  @ManyToOne(() => Unit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unitId' })
  unit?: Unit;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
