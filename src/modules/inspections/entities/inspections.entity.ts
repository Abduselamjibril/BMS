import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Lease } from '../../leases/entities/lease.entity';
import { User } from '../../users/entities/user.entity';
import { InspectionType, InspectionStatus, ItemCondition } from './inspection.types';

@Entity('inspections')
@Index('idx_inspection_status', ['status'])
@Index('idx_inspection_type', ['type'])
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Lease)
  lease: Lease;

  @Column({ type: 'enum', enum: InspectionType })
  type: InspectionType;

  @Column({ type: 'enum', enum: InspectionStatus, default: InspectionStatus.PENDING })
  status: InspectionStatus;

  @ManyToOne(() => User, { nullable: true })
  verified_by: User;

  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date;

  @Column({ type: 'text', nullable: true })
  tenant_signature: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => InspectionItem, (item) => item.inspection)
  items: InspectionItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('inspection_items')
export class InspectionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Inspection, (inspection) => inspection.items, { onDelete: 'CASCADE' })
  inspection: Inspection;

  @Column()
  room_category: string;

  @Column()
  item_name: string;

  @Column({ type: 'enum', enum: ItemCondition, default: ItemCondition.GOOD })
  condition: ItemCondition;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'simple-array', nullable: true })
  photos: string[];

  @Column({ default: false })
  is_verified: boolean;
}
