import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ManagementCompany } from '../../management/entities/management-company.entity';
import { Building } from '../../buildings/entities/building.entity';

export enum CommissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ManagementCompany, { nullable: false })
  @JoinColumn({ name: 'nominee_id' })
  nominee: ManagementCompany;

  @Column()
  nominee_id: string;

  @ManyToOne(() => Building, { nullable: true })
  @JoinColumn({ name: 'building_id' })
  building: Building;

  @Column({ nullable: true })
  building_id: string;

  @Column()
  source_type: string; // LEASE, PAYMENT, MAINTENANCE

  @Column()
  source_id: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  amount_base: number; // The rent or maintenance amount it was calculated from

  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.PENDING })
  status: CommissionStatus;

  @Column({ type: 'date', nullable: true })
  period_start: string;

  @Column({ type: 'date', nullable: true })
  period_end: string;

  @CreateDateColumn()
  calculated_at: Date;
}
