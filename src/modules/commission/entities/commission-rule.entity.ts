import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Building } from '../../buildings/entities/building.entity';
import { ManagementCompany } from '../../management/entities/management-company.entity';

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum CommissionBasis {
  RENT = 'RENT',
  PAYMENT = 'PAYMENT',
  LEASE = 'LEASE',
  OCCUPANCY = 'OCCUPANCY',
  MAINTENANCE = 'MAINTENANCE',
}

export enum CommissionFrequency {
  MONTHLY = 'MONTHLY',
  PER_LEASE = 'PER_LEASE',
  PER_TRANSACTION = 'PER_TRANSACTION',
}

@Entity('commission_rules')
@Index('idx_commrule_nominee', ['nominee_id'])
@Index('idx_commrule_building', ['building_id'])
@Index('idx_commrule_active', ['is_active'])
export class CommissionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Building, { nullable: true })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ nullable: true })
  building_id: string;

  @ManyToOne(() => ManagementCompany, { nullable: false })
  @JoinColumn({ name: 'nominee_id' })
  nominee: ManagementCompany;

  @Column()
  nominee_id: string;

  @Column({ type: 'enum', enum: CommissionType })
  type: CommissionType;

  @Column('decimal', { precision: 10, scale: 2 })
  rate: number;

  @Column({ type: 'enum', enum: CommissionBasis })
  basis: CommissionBasis;

  @Column({ type: 'enum', enum: CommissionFrequency })
  frequency: CommissionFrequency;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
